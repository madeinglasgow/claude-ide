const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const WORKSPACE_DIR = path.resolve(process.env.WORKSPACE_DIR || './workspace');

function safePath(requestedPath) {
  const resolved = path.resolve(WORKSPACE_DIR, requestedPath);
  if (!resolved.startsWith(WORKSPACE_DIR + path.sep) && resolved !== WORKSPACE_DIR) {
    return null;
  }
  return resolved;
}

function buildTree(dirPath, relativeTo) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(relativeTo, fullPath);

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children: buildTree(fullPath, relativeTo),
      });
    } else {
      result.push({
        name: entry.name,
        path: relPath,
        type: 'file',
      });
    }
  }

  result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });

  return result;
}

router.get('/tree', (req, res) => {
  try {
    const tree = buildTree(WORKSPACE_DIR, WORKSPACE_DIR);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/read', (req, res) => {
  const filePath = safePath(req.query.path || '');
  if (!filePath) return res.status(400).json({ error: 'Invalid path' });

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

router.post('/write', (req, res) => {
  const filePath = safePath(req.body.path || '');
  if (!filePath) return res.status(400).json({ error: 'Invalid path' });

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, req.body.content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
