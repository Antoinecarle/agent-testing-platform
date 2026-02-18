import { useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api';

/**
 * React hook for bulk file import into a knowledge base.
 * Manages: idle -> uploading -> processing -> done lifecycle.
 * Uses Socket.IO for real-time progress + polling fallback.
 */
export default function useBulkImport(knowledgeBaseId) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | error
  const [files, setFiles] = useState([]); // { id, name, size, status, error }
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, processing: 0 });
  const [jobId, setJobId] = useState(null);
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const cancelledRef = useRef(false);
  const jobIdRef = useRef(null);

  // Clean up socket + polling on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Polling fallback: fetch job status every 2s
  const startPolling = useCallback((kbId, jId) => {
    stopPolling();
    const token = getToken();

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/knowledge/${kbId}/bulk-import/${jId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();

        // Update stats
        if (data.stats) setStats(data.stats);

        // Update file statuses
        if (data.files) {
          setFiles(prev => {
            const serverMap = new Map(data.files.map(f => [f.id, f]));
            return prev.map(f => {
              const sf = serverMap.get(f.id);
              if (sf && sf.status !== f.status) {
                return { ...f, status: sf.status, error: sf.error || f.error };
              }
              return f;
            });
          });
        }

        // Check if done
        if (data.status === 'done' || data.status === 'cancelled') {
          setPhase('done');
          stopPolling();
        }
      } catch (_) {
        // Ignore polling errors
      }
    }, 2000);
  }, [stopPolling]);

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
        stopPolling();
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[BulkImport] Socket connect error, relying on polling:', err.message);
    });

    socketRef.current = socket;
  }, [stopPolling]);

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
      jobIdRef.current = jId;

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

      // Step 4: Start processing + polling fallback
      setPhase('processing');
      startPolling(knowledgeBaseId, jId);

      const processRes = await fetch(
        `/api/knowledge/${knowledgeBaseId}/bulk-import/${jId}/process`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }
      );
      if (!processRes.ok) throw new Error('Failed to start processing');

    } catch (err) {
      setPhase('error');
      stopPolling();
      console.error('[BulkImport] Error:', err.message);
    }
  }, [knowledgeBaseId, connectSocket, startPolling, stopPolling]);

  const cancelImport = useCallback(async () => {
    cancelledRef.current = true;
    stopPolling();
    const jId = jobIdRef.current;
    if (jId && knowledgeBaseId) {
      const token = getToken();
      try {
        await fetch(`/api/knowledge/${knowledgeBaseId}/bulk-import/${jId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      } catch (_) {}
    }
    setPhase('done');
  }, [knowledgeBaseId, stopPolling]);

  const reset = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    stopPolling();
    setPhase('idle');
    setFiles([]);
    setUploadProgress({ current: 0, total: 0 });
    setStats({ total: 0, completed: 0, failed: 0, processing: 0 });
    setJobId(null);
    jobIdRef.current = null;
    cancelledRef.current = false;
  }, [stopPolling]);

  return { phase, files, uploadProgress, stats, jobId, startImport, cancelImport, reset };
}
