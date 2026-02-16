import { useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api';

/**
 * React hook for bulk file import into a knowledge base.
 * Manages: idle -> uploading -> processing -> done lifecycle.
 * Connects to /knowledge Socket.IO namespace for real-time progress.
 */
export default function useBulkImport(knowledgeBaseId) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | error
  const [files, setFiles] = useState([]); // { id, name, size, status, error }
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, processing: 0 });
  const [jobId, setJobId] = useState(null);
  const socketRef = useRef(null);
  const cancelledRef = useRef(false);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const connectSocket = useCallback((jId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const token = getToken();
    const socket = io('/knowledge', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join-import', { jobId: jId });
    });

    socket.on('file-progress', ({ fileId, status, error }) => {
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status, error: error || f.error } : f
      ));
    });

    socket.on('job-progress', ({ stats: newStats, status }) => {
      setStats(newStats);
      if (status === 'done' || status === 'cancelled') {
        setPhase('done');
      }
    });

    socketRef.current = socket;
  }, []);

  const startImport = useCallback(async (selectedFiles) => {
    if (!knowledgeBaseId || !selectedFiles.length) return;
    cancelledRef.current = false;

    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    // Initialize file list with queued status
    const fileList = Array.from(selectedFiles).map((f, i) => ({
      id: `local-${i}`,
      name: f.name,
      size: f.size,
      status: 'queued',
      error: null,
    }));
    setFiles(fileList);
    setStats({ total: fileList.length, completed: 0, failed: 0, processing: 0 });

    try {
      // Step 1: Create job
      setPhase('uploading');
      const startRes = await fetch(`/api/knowledge/${knowledgeBaseId}/bulk-import/start`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!startRes.ok) throw new Error('Failed to create import job');
      const { jobId: jId } = await startRes.json();
      setJobId(jId);

      // Step 2: Connect socket for progress
      connectSocket(jId);

      // Step 3: Upload in batches of 20
      const BATCH_SIZE = 20;
      const allFiles = Array.from(selectedFiles);
      const totalBatches = Math.ceil(allFiles.length / BATCH_SIZE);

      for (let b = 0; b < totalBatches; b++) {
        if (cancelledRef.current) break;

        setUploadProgress({ current: b + 1, total: totalBatches });
        const batch = allFiles.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const formData = new FormData();
        batch.forEach(f => formData.append('files', f));

        const uploadRes = await fetch(
          `/api/knowledge/${knowledgeBaseId}/bulk-import/${jId}/upload`,
          { method: 'POST', headers, body: formData }
        );
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || `Upload batch ${b + 1} failed`);
        }

        // Update local file IDs from server response
        const { files: serverFiles } = await uploadRes.json();
        if (serverFiles) {
          setFiles(prev => {
            const updated = [...prev];
            const startIdx = b * BATCH_SIZE;
            serverFiles.forEach((sf, i) => {
              if (updated[startIdx + i]) {
                updated[startIdx + i].id = sf.id;
              }
            });
            return updated;
          });
        }
      }

      if (cancelledRef.current) return;

      // Step 4: Start processing
      setPhase('processing');
      const processRes = await fetch(
        `/api/knowledge/${knowledgeBaseId}/bulk-import/${jId}/process`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }
      );
      if (!processRes.ok) throw new Error('Failed to start processing');

    } catch (err) {
      setPhase('error');
      console.error('[BulkImport] Error:', err.message);
    }
  }, [knowledgeBaseId, connectSocket]);

  const cancelImport = useCallback(async () => {
    cancelledRef.current = true;
    if (jobId && knowledgeBaseId) {
      const token = getToken();
      try {
        await fetch(`/api/knowledge/${knowledgeBaseId}/bulk-import/${jobId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      } catch (_) {}
    }
    setPhase('done');
  }, [jobId, knowledgeBaseId]);

  const reset = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setPhase('idle');
    setFiles([]);
    setUploadProgress({ current: 0, total: 0 });
    setStats({ total: 0, completed: 0, failed: 0, processing: 0 });
    setJobId(null);
    cancelledRef.current = false;
  }, []);

  return { phase, files, uploadProgress, stats, jobId, startImport, cancelImport, reset };
}
