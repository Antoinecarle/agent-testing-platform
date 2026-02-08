import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getToken } from '../api';

const THEME = {
  background: '#0f0f0f',
  foreground: '#e4e4e7',
  cursor: '#8B5CF6',
  cursorAccent: '#0f0f0f',
  selectionBackground: '#3b3d5e80',
  black: '#1a1b2e', red: '#f87171', green: '#4ade80', yellow: '#facc15',
  blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e4e4e7',
  brightBlack: '#4b5563', brightRed: '#fca5a5', brightGreen: '#86efac', brightYellow: '#fde68a',
  brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#f9fafb',
};

export default function useTerminal(containerRef, { sessionId, projectId, onSessionCreated }) {
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const socketRef = useRef(null);
  const currentSessionRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 15,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    const token = getToken();
    if (!token) return;

    const socket = io('/terminal', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      if (sessionId) {
        // Reattach to existing session — scrollback will replay
        socket.emit('attach-session', {
          id: sessionId,
          cols: term.cols || 120,
          rows: term.rows || 30,
          replay: true,
        }, (res) => {
          if (res && res.error) {
            // Session died, create new
            createNew();
          } else {
            currentSessionRef.current = sessionId;
          }
        });
      } else {
        createNew();
      }
    });

    function createNew() {
      socket.emit('create-session', {
        cols: term.cols || 120,
        rows: term.rows || 30,
        projectId: projectId || '',
      }, (res) => {
        if (res.error) {
          console.error(res.error);
          if (termRef.current) {
            termRef.current.write('\r\n\x1b[31m  ' + res.error + '\x1b[0m\r\n');
            termRef.current.write('\x1b[90m  Terminal features require a local environment with node-pty.\x1b[0m\r\n');
          }
          return;
        }
        currentSessionRef.current = res.id;
        socket.emit('attach-session', {
          id: res.id,
          cols: term.cols || 120,
          rows: term.rows || 30,
        });
        if (onSessionCreated) onSessionCreated(res.id);
      });
    }

    socket.on('output', (data) => {
      if (termRef.current) termRef.current.write(data);
    });

    socket.on('session-exited', () => {
      if (termRef.current) {
        termRef.current.write('\r\n\x1b[33m[Session ended. Close this tab or create a new one.]\x1b[0m\r\n');
      }
    });

    socket.on('disconnect', () => setConnected(false));

    term.onData((data) => {
      if (socketRef.current && currentSessionRef.current) {
        socketRef.current.emit('input', data);
      }
    });

    term.onResize(({ cols, rows }) => {
      if (socketRef.current) {
        socketRef.current.emit('resize', { cols, rows });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch (_) {}
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (socketRef.current) {
        // Detach only — do NOT kill the session
        socketRef.current.emit('detach-session');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      currentSessionRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [containerRef, sessionId, projectId]);

  const sendInput = useCallback((text) => {
    if (socketRef.current && currentSessionRef.current) {
      socketRef.current.emit('input', text);
    }
  }, []);

  return { connected, sendInput };
}
