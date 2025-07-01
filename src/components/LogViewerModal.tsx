import React, { useEffect, useState } from 'react';

interface LogViewerModalProps {
  onClose: () => void;
}

const LogViewerModal: React.FC<LogViewerModalProps> = ({ onClose }) => {
  const [log, setLog] = useState('Loading...');

  useEffect(() => {
    window.electron.getLatestLog().then(setLog).catch(() => setLog('Failed to load log.'));
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#222', color: '#fff', borderRadius: 10, maxWidth: 800, width: '90vw', maxHeight: '80vh', padding: 24, boxShadow: '0 8px 32px #0008', overflow: 'auto', fontFamily: 'monospace', fontSize: 14, position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        <h2 style={{ marginTop: 0 }}>Latest Log</h2>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{log}</pre>
      </div>
    </div>
  );
};

export default LogViewerModal; 