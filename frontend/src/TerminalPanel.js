import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

function TerminalPanel({ visible = true }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Initialize xterm
    if (!xtermRef.current) {
      xtermRef.current = new Terminal({
        fontSize: 14,
        theme: {
          background: '#181c23',
          foreground: '#e0e0e0',
          cursor: '#7fd',
        },
        cols: 80,
        rows: 18,
        cursorBlink: true,
      });
      xtermRef.current.open(terminalRef.current);
    }

    // Connect to backend WebSocket
    wsRef.current = new WebSocket('ws://localhost:8000/ws/terminal/');
    wsRef.current.onopen = () => {
      xtermRef.current.writeln('Connected to real terminal!');
    };
    wsRef.current.onmessage = (event) => {
      xtermRef.current.write(event.data);
    };
    wsRef.current.onclose = () => {
      xtermRef.current.writeln('\r\n[Connection closed]');
    };
    wsRef.current.onerror = (err) => {
      xtermRef.current.writeln('\r\n[WebSocket error]');
    };

    // Send user input to backend
    const onData = (data) => {
      wsRef.current && wsRef.current.readyState === 1 && wsRef.current.send(data);
    };
    xtermRef.current.onData(onData);

    return () => {
      xtermRef.current && xtermRef.current.dispose();
      wsRef.current && wsRef.current.close();
    };
  }, []);

  // Refresh xterm when visible
  useEffect(() => {
    if (visible && xtermRef.current) {
      setTimeout(() => {
        try {
          xtermRef.current.refresh(0, xtermRef.current.rows - 1);
        } catch (e) {}
      }, 50);
    }
  }, [visible]);

  return (
    <div style={{ background: '#181c23', color: '#e0e0e0', height: 180, borderTop: '1px solid #23272e', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

export default TerminalPanel;
