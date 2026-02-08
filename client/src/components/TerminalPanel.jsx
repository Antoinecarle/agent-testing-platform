import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import useTerminal from '../hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

const TerminalPanel = forwardRef(function TerminalPanel({ sessionId, projectId, onSessionCreated }, ref) {
  const containerRef = useRef(null);
  const { connected, sendInput } = useTerminal(containerRef, {
    sessionId,
    projectId,
    onSessionCreated,
  });

  useImperativeHandle(ref, () => ({
    sendInput,
  }), [sendInput]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050505' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!connected && (
        <div style={{
          position: 'absolute', bottom: '8px', right: '8px',
          fontSize: '10px', color: '#52525B', fontFamily: 'monospace',
        }}>
          Connecting...
        </div>
      )}
    </div>
  );
});

export default TerminalPanel;
