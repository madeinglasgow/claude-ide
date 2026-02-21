const pty = require('node-pty');
const path = require('path');

function attachPty(ws) {
  const shell = process.env.TERMINAL_CMD || process.env.SHELL || '/bin/zsh';
  const cwd = path.resolve(process.env.WORKSPACE_DIR || './workspace');

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    console.error('Failed to spawn PTY:', err.message);
    ws.send(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
    ws.close();
    return;
  }

  ptyProcess.onData((data) => {
    try {
      ws.send(data);
    } catch (e) {
      // client disconnected
    }
  });

  ws.on('message', (msg) => {
    const str = msg.toString();

    // Check for JSON control messages
    if (str.startsWith('{')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch (e) {
        // Not JSON, treat as terminal input
      }
    }

    ptyProcess.write(str);
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });

  ptyProcess.onExit(() => {
    try {
      ws.close();
    } catch (e) {
      // already closed
    }
  });
}

module.exports = { attachPty };
