import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function Terminal() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 15,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      theme: {
        background: '#faf8f7',
        foreground: '#2d2d2d',
        cursor: '#e8736a',
        cursorAccent: '#faf8f7',
        selectionBackground: '#f0e8e5',
        black: '#2d2d2d',
        red: '#c94038',
        green: '#2a8a5a',
        yellow: '#b87a20',
        blue: '#2868b0',
        magenta: '#9040a0',
        cyan: '#1a8a7a',
        white: '#5a5a5a',
        brightBlack: '#9a9a9a',
        brightRed: '#e8736a',
        brightGreen: '#4caf7d',
        brightYellow: '#e8a34e',
        brightBlue: '#6a9ee8',
        brightMagenta: '#c47ed4',
        brightCyan: '#5ec4b6',
        brightWhite: '#2d2d2d',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;

    // Fit after a brief delay to ensure container is sized
    requestAnimationFrame(() => {
      fit.fit();
    });

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial size
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch (e) {
        // ignore fit errors during transitions
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px 0 0 4px',
      }}
    />
  );
}
