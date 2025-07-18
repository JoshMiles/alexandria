import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import './startup.css';

const parseProgress = (msg: string): number | null => {
  const match = msg.match(/(\d{1,3})%/);
  if (match) {
    const pct = parseInt(match[1], 10);
    if (!isNaN(pct)) return Math.max(0, Math.min(100, pct));
  }
  return null;
};

const StartupContent = () => {
  const { t } = useI18n();
  const [message, setMessage] = useState(t('app.loading'));
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    window.electron.on('update-message', (newMessage) => {
      setMessage(newMessage);
      setProgress(parseProgress(newMessage));
    });
  }, []);

  return (
    <div className="startup-bg">
      <div className="startup-card">
        <div className="startup-logo">{t('app.name')}</div>
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

const Startup = () => (
  <I18nProvider>
    <StartupContent />
  </I18nProvider>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Startup />);
}
