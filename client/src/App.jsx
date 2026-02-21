import React, { useState, useCallback, useRef, useEffect } from 'react';
import FileBrowser from './components/FileBrowser';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import Preview from './components/Preview';

export default function App() {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [openFile, setOpenFile] = useState(null); // { path, content }
  const [dirty, setDirty] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // percentage
  const [docsHeight, setDocsHeight] = useState(200); // px
  const [previewActive, setPreviewActive] = useState(false);
  const [previewSplit, setPreviewSplit] = useState(50); // percent of terminal-area for terminal
  const [previewPortUp, setPreviewPortUp] = useState(false);
  const vResizing = useRef(false);
  const hResizing = useRef(false);
  const previewResizing = useRef(false);
  const savedLeftPanelWidth = useRef(null);
  const wasCollapsedBeforePreview = useRef(false);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (vResizing.current) {
        const pct = (e.clientX / window.innerWidth) * 100;
        setLeftPanelWidth(Math.min(Math.max(pct, 15), 60));
      }
      if (hResizing.current) {
        // docsHeight is relative to the top of the left panel
        const leftPanel = document.querySelector('.left-panel');
        if (leftPanel) {
          const rect = leftPanel.getBoundingClientRect();
          const newHeight = e.clientY - rect.top;
          setDocsHeight(Math.min(Math.max(newHeight, 80), rect.height - 100));
        }
      }
      if (previewResizing.current) {
        const terminalArea = document.querySelector('.terminal-area');
        if (terminalArea) {
          const rect = terminalArea.getBoundingClientRect();
          const pct = ((e.clientX - rect.left) / rect.width) * 100;
          setPreviewSplit(Math.min(Math.max(pct, 20), 80));
        }
      }
    };
    const onMouseUp = () => {
      if (vResizing.current || hResizing.current || previewResizing.current) {
        if (previewResizing.current) {
          const ta = document.querySelector('.terminal-area');
          if (ta) ta.classList.remove('resizing');
        }
        vResizing.current = false;
        hResizing.current = false;
        previewResizing.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Poll preview port status every 3s
  useEffect(() => {
    const previewUrl = `http://${window.location.hostname}:5173`;
    const check = async () => {
      try {
        await fetch(previewUrl, { mode: 'no-cors' });
        setPreviewPortUp(true);
      } catch {
        setPreviewPortUp(false);
      }
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  const handleVResizeStart = useCallback((e) => {
    e.preventDefault();
    vResizing.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);

  const handleHResizeStart = useCallback((e) => {
    e.preventDefault();
    hResizing.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }, []);

  const handlePreviewResizeStart = useCallback((e) => {
    e.preventDefault();
    previewResizing.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const ta = document.querySelector('.terminal-area');
    if (ta) ta.classList.add('resizing');
  }, []);

  const togglePreview = useCallback(() => {
    setPreviewActive((prev) => {
      if (!prev) {
        // Activating: save current state and collapse left panel
        savedLeftPanelWidth.current = leftPanelWidth;
        wasCollapsedBeforePreview.current = leftPanelCollapsed;
        setLeftPanelCollapsed(true);
      } else {
        // Deactivating: restore previous state
        if (!wasCollapsedBeforePreview.current) {
          setLeftPanelCollapsed(false);
          if (savedLeftPanelWidth.current !== null) {
            setLeftPanelWidth(savedLeftPanelWidth.current);
          }
        }
      }
      return !prev;
    });
  }, [leftPanelWidth, leftPanelCollapsed]);

  const handleFileSelect = useCallback(async (filePath) => {
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setOpenFile({ path: filePath, content: data.content });
        setDirty(false);
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, []);

  const handleContentChange = useCallback((newContent) => {
    setOpenFile((prev) => prev ? { ...prev, content: newContent } : null);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!openFile) return;
    try {
      await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openFile.path, content: openFile.content }),
      });
      setDirty(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [openFile]);

  const handleNewDoc = useCallback(async () => {
    const name = prompt('Document name (e.g. notes.md):');
    if (!name) return;
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    try {
      await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileName, content: '' }),
      });
      // Open the newly created file
      setOpenFile({ path: fileName, content: '' });
      setDirty(false);
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  }, []);

  const layoutClasses = [
    'app-layout',
    leftPanelCollapsed && 'left-panel-collapsed',
    previewActive && 'preview-active',
  ].filter(Boolean).join(' ');

  const gridStyle = !leftPanelCollapsed
    ? { gridTemplateColumns: `${leftPanelWidth}% auto 1fr` }
    : undefined;

  return (
    <div className={layoutClasses} style={gridStyle}>
      {/* LEFT COLUMN */}
      <div className="left-panel" style={leftPanelCollapsed ? { overflow: 'hidden', width: 0 } : {}}>
        {/* Documents list */}
        <div className="documents-panel" style={{ height: docsHeight }}>
          <div className="panel-header">
            <span>Documents</span>
            <div className="panel-header-actions">
              <button className="new-doc-btn" onClick={handleNewDoc} title="New document">+</button>
              <button onClick={() => setLeftPanelCollapsed(true)} title="Collapse panel">&times;</button>
            </div>
          </div>
          <div className="panel-content">
            <FileBrowser onFileSelect={handleFileSelect} activeFile={openFile?.path} />
          </div>
        </div>

        {/* Horizontal resize handle between doc list and editor */}
        <div className="h-resize-handle" onMouseDown={handleHResizeStart} />

        {/* Editor area */}
        <div className="editor-area">
          {openFile ? (
            <>
              <div className="editor-toolbar">
                <span className="editor-toolbar-filename">{openFile.path.split('/').pop()}</span>
                {dirty && <span className="editor-toolbar-dirty">Unsaved</span>}
                <div className="editor-toolbar-actions">
                  <button className="toolbar-save-btn" onClick={handleSave}>Save</button>
                  <button
                    className="toolbar-close-btn"
                    onClick={(e) => { e.stopPropagation(); setOpenFile(null); setDirty(false); }}
                  >
                    &times;
                  </button>
                </div>
              </div>
              <Editor
                content={openFile.content}
                onChange={handleContentChange}
                onSave={handleSave}
              />
            </>
          ) : (
            <div className="editor-placeholder">
              Select a document to start writing
            </div>
          )}
        </div>
      </div>

      {/* Vertical resize handle between left panel and terminal */}
      <div className="v-resize-handle" onMouseDown={handleVResizeStart} />

      {/* RIGHT COLUMN - TERMINAL (hero) */}
      <div className={`terminal-area${previewActive ? ' terminal-area-split' : ''}`}>
        {/* Terminal sub-panel */}
        <div
          className="terminal-sub-panel"
          style={previewActive ? { width: `${previewSplit}%` } : undefined}
        >
          {leftPanelCollapsed && (
            <button
              className="left-panel-toggle"
              onClick={() => setLeftPanelCollapsed(false)}
              title="Show documents"
            >
              &#9776;
            </button>
          )}
          <div className="panel-header">
            <span>Terminal</span>
            <div className="panel-header-actions">
              <button
                className={`preview-toggle-btn${previewActive ? ' active' : ''}${previewPortUp ? ' port-live' : ''}`}
                onClick={togglePreview}
                title={previewActive ? 'Close preview' : 'Open preview'}
              >
                &#9655; Preview
              </button>
            </div>
          </div>
          <div className="panel-content">
            <Terminal />
          </div>
        </div>

        {/* Preview resize handle + preview panel */}
        {previewActive && (
          <>
            <div className="preview-resize-handle" onMouseDown={handlePreviewResizeStart} />
            <div className="preview-sub-panel">
              <Preview onClose={togglePreview} serverUp={previewPortUp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
