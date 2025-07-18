import React, { useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import './Settings.css';
import { FiGlobe, FiPlus, FiX, FiZap, FiInfo, FiGithub } from 'react-icons/fi';
import LiveLogViewer from './LiveLogViewer';

interface SettingsProps {
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const [version, setVersion] = useState('');
  const [resettingAccess, setResettingAccess] = useState(false);
  const [testingAccess, setTestingAccess] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [latestRelease, setLatestRelease] = useState('');

  useEffect(() => {
    window.electron.getVersion().then(setVersion);
    // Fetch latest release from GitHub
    fetch('https://api.github.com/repos/JoshMiles/alexandria/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && data.tag_name) setLatestRelease(data.tag_name);
      })
      .catch(() => setLatestRelease('Unavailable'));
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMessage('');
    try {
      const result = await window.electron.checkForUpdates();
      if (result.success) {
        setUpdateMessage('Checking for updates...');
      } else {
        setUpdateMessage('Failed to check for updates.');
      }
    } catch (e) {
      setUpdateMessage('Error checking for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <>
      <div className="settings-root">
        <div className="settings-grid-container">
          <div className="settings-header-row">
            <button className="back-button top-left" onClick={onClose}>{t('app.back')}</button>
            <h1 className="settings-header-title">{t('settings.title')}</h1>
          </div>
          <div className="settings-grid">
            {/* Only non-theme settings remain here */}
            {/* Language, update, etc. */}
            {/* Language */}
            <div className="settings-panel settings-grid-item">
              <div className="panel-header">
                <span className="panel-title">{t('settings.language')}</span>
                <span className="panel-tooltip" title="Change the app's language."><FiInfo /></span>
              </div>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="settings-language-dropdown"
              >
                {Object.entries(availableLanguages).map(([code, lang]) => (
                  <option key={code} value={code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
            {/* Logger (full width) */}
            <div className="settings-panel settings-logger-panel">
              <div className="panel-header">
                <span className="panel-title">Logs</span>
                <span className="panel-tooltip" title="View and filter the app's logs."><FiInfo /></span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                <button className="reset-button" style={{ flex: 'none' }} onClick={() => window.electron.openLogsFolder()}>
                  Open Logs Folder
                </button>
              </div>
              <LiveLogViewer />
            </div>
            {/* Advanced */}
            <div className="settings-panel settings-grid-item">
              <div className="panel-header">
                <span className="panel-title">Advanced</span>
                <span className="panel-tooltip" title="Advanced app actions."><FiInfo /></span>
              </div>
              <button className="reset-button" onClick={() => window.electron.clearAppData()}>
                Clear App Data (Store & Logs)
              </button>
            </div>
            {/* Version Info */}
            <div className="settings-panel settings-grid-item">
              <div className="panel-header">
                <span className="panel-title">{t('settings.version')}</span>
                <span className="panel-tooltip" title="App version."><FiInfo /></span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent)', margin: '0.5rem 0 0.25rem 0' }}>
                Current App Version: <span style={{ fontWeight: 900 }}>{version}</span>
              </div>
              <div style={{ fontSize: '1rem', color: 'var(--foreground-dark)', marginBottom: '1rem' }}>
                Latest Release: <span style={{ fontWeight: 700 }}>{latestRelease}</span>
              </div>
              <button className="reset-button" onClick={handleCheckForUpdates} disabled={checkingUpdate}>
                {checkingUpdate ? 'Checking for Updates...' : 'Check for Updates'}
              </button>
              {updateMessage && <p style={{ marginTop: '0.5rem', color: 'var(--accent)' }}>{updateMessage}</p>}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <a href="https://github.com/JoshMiles/alexandria" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--foreground-dark)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 22 }} title="View on GitHub">
                  <FiGithub size={28} style={{ verticalAlign: 'middle' }} />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
