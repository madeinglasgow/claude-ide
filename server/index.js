const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const filesRouter = require('./files');
const { attachPty } = require('./pty');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// File API routes
app.use('/api/files', filesRouter);

// In production, serve the built client
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// WebSocket server for terminal
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      attachPty(ws);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.IDE_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
