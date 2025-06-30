import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './startup.css';

const parseProgress = (msg: string): number | null => {
  const match = msg.match(/(\d{1,3})%/);
  if (match) {
    const pct = parseInt(match[1], 10);
    if (!isNaN(pct)) return Math.max(0, Math.min(100, pct));
  }
  return null;
};

const parseLibGenProgress = (msg: string): number | null => {
  // Parse LibGen mirror testing progress
  const mirrorMatch = msg.match(/Testing mirror (\d+)\/(\d+):/);
  if (mirrorMatch) {
    const current = parseInt(mirrorMatch[1], 10);
    const total = parseInt(mirrorMatch[2], 10);
    if (!isNaN(current) && !isNaN(total) && total > 0) {
      return Math.round((current / total) * 100);
    }
  }
  return null;
};

const Startup = () => {
  const [message, setMessage] = useState('Checking for updates...');
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    window.electron.on('update-message', (newMessage) => {
      setMessage(newMessage);
      setProgress(parseProgress(newMessage));
    });

    // Listen for LibGen access check messages
    window.electron.on('search-status', (newMessage) => {
      setMessage(newMessage);
      const libgenProgress = parseLibGenProgress(newMessage);
      if (libgenProgress !== null) {
        setProgress(libgenProgress);
      } else if (newMessage.includes('Testing main LibGen domain') || 
                 newMessage.includes('Main domain unavailable') ||
                 newMessage.includes('Found working mirror') ||
                 newMessage.includes('All LibGen mirrors are currently unavailable')) {
        setProgress(null); // Use indeterminate for these messages
      }
    });
  }, []);

  return (
    <div className="startup-bg">
      <div className="startup-card">
        <div className="startup-logo">Alexandria</div>
        <div className="startup-progress-bar-wrapper">
          {progress !== null ? (
            <div className="startup-progress-bar">
              <div
                className="startup-progress-bar-inner"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : (
            <div className="startup-progress-bar indeterminate">
              <div className="startup-progress-bar-inner indeterminate" />
            </div>
          )}
        </div>
        <div className="startup-status">{message}</div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Startup />);
}
