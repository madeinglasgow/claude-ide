import React, { useState, useEffect, useCallback } from 'react';

function collectMarkdownFiles(nodes, prefix = '') {
  const files = [];
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      files.push(...collectMarkdownFiles(node.children, prefix ? `${prefix}/${node.name}` : node.name));
    } else if (node.name.match(/\.(md|markdown)$/i)) {
      files.push({
        path: node.path,
        name: node.name,
        subpath: prefix || null,
      });
    }
  }
  return files;
}

export default function FileBrowser({ onFileSelect, activeFile }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/files/tree');
      const data = await res.json();
      setTree(data);
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
    const interval = setInterval(fetchTree, 2000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  if (loading) {
    return <div style={{ padding: 12, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  const mdFiles = collectMarkdownFiles(tree);

  if (mdFiles.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
        No documents yet
      </div>
    );
  }

  return (
    <div className="file-tree">
      {mdFiles.map((file) => (
        <div
          key={file.path}
          className={`file-tree-item ${activeFile === file.path ? 'active' : ''}`}
          onClick={() => onFileSelect(file.path)}
        >
          <span className="name">{file.name}</span>
          {file.subpath && <span className="subpath">{file.subpath}/</span>}
        </div>
      ))}
    </div>
  );
}
