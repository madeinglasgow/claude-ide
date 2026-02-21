const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const filesRouter = require('./files');
const { attachPty } = require('./pty');
const { attachConversation } = require('./conversation');

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

// WebSocket servers
const terminalWss = new WebSocketServer({ noServer: true });
const conversationWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      attachPty(ws);
    });
  } else if (request.url === '/ws/conversation') {
    conversationWss.handleUpgrade(request, socket, head, (ws) => {
      attachConversation(ws);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.IDE_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
