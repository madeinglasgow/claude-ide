import React, { useState, useCallback } from 'react';

export default function Preview({ onClose, serverUp }) {
  const [iframeKey, setIframeKey] = useState(0);
  const previewUrl = `http://${window.location.hostname}:5173`;

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="panel-header">
        <span>Preview</span>
        <div className="panel-header-actions">
          {serverUp && (
            <button onClick={handleRefresh} title="Refresh preview">&#x21bb;</button>
          )}
          <button onClick={onClose} title="Close preview">&times;</button>
        </div>
      </div>
      <div className="panel-content" style={{ position: 'relative' }}>
        {serverUp ? (
          <iframe
            key={iframeKey}
            src={previewUrl}
            className="preview-iframe"
            title="App Preview"
          />
        ) : (
          <div className="preview-placeholder">
            <div className="preview-placeholder-icon" />
            <p>Start your app on port 5173 to see it here</p>
          </div>
        )}
      </div>
    </>
  );
}
