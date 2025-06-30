import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './Settings.css';
import { FiGlobe, FiPlus, FiX, FiZap } from 'react-icons/fi';

interface SettingsProps {
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const {
    theme,
    setTheme,
    lightAccent,
    setLightAccent,
    darkAccent,
    setDarkAccent,
    downloadButtonColor,
    setDownloadButtonColor,
    libgenUrl,
    setLibgenUrl,
    downloadLocation,
    setDownloadLocation,
    resetToDefaults,
  } = useTheme();

  const [version, setVersion] = useState('');
  const [libgenAccessInfo, setLibgenAccessInfo] = useState<{ mirrors: string[]; proxies: string[]; currentMethod: { proxy: string | null; mirror: string | null } | null; lastError: string | null } | null>(null);
  const [resettingAccess, setResettingAccess] = useState(false);
  const [newMirror, setNewMirror] = useState('');
  const [testingAccess, setTestingAccess] = useState(false);

  const socks5Regex = /^socks5:\/\/[\d.]+:\d{2,5}$/;

  useEffect(() => {
    const fetchVersion = async () => {
      const appVersion = await window.electron.getVersion();
      setVersion(appVersion);
    };
    fetchVersion();
    // Fetch LibGen access info
    window.electron.getLibgenAccessInfo().then((info) => setLibgenAccessInfo(normalizeAccessInfo(info)));
  }, []);

  // Helper to normalize currentMethod
  function normalizeAccessInfo(info: any): typeof libgenAccessInfo {
    if (!info) return info;
    if (typeof info.currentMethod === 'string' && info.currentMethod) {
      // Try to guess if it's a proxy or mirror
      const isProxy = info.proxies && info.proxies.includes(info.currentMethod);
      const isMirror = info.mirrors && info.mirrors.includes(info.currentMethod);
      return {
        ...info,
        currentMethod: isProxy
          ? { proxy: info.currentMethod, mirror: null }
          : isMirror
          ? { proxy: null, mirror: info.currentMethod }
          : { proxy: null, mirror: null },
      };
    }
    if (info.currentMethod === null || typeof info.currentMethod === 'object') {
      return info;
    }
    return { ...info, currentMethod: { proxy: null, mirror: null } };
  }

  const handleResetAccess = async () => {
    setResettingAccess(true);
    await window.electron.resetLibgenAccessMethod();
    const info = await window.electron.getLibgenAccessInfo();
    setLibgenAccessInfo(normalizeAccessInfo(info));
    setResettingAccess(false);
  };

  const handleAddMirror = async () => {
    if (newMirror.trim()) {
      const info = await window.electron.addLibgenMirror(newMirror.trim());
      setLibgenAccessInfo(normalizeAccessInfo(info));
      setNewMirror('');
    }
  };

  const handleRemoveMirror = async (url: string) => {
    const info = await window.electron.removeLibgenMirror(url);
    setLibgenAccessInfo(normalizeAccessInfo(info));
  };

  const handleTestAccess = async () => {
    setTestingAccess(true);
    try {
      const result = await window.electron.testLibgenAccess();
      if (result.success) {
        // Refresh the access info to show the working mirror
        const info = await window.electron.getLibgenAccessInfo();
        setLibgenAccessInfo(normalizeAccessInfo(info));
      }
    } catch (error) {
      console.error('Error testing LibGen access:', error);
    } finally {
      setTestingAccess(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={onClose}>
          Back
        </button>
        <h1>Settings</h1>
      </div>
      <div className="setting-section">
        <h2>Theme</h2>
        <div className="theme-options">
          <label>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.value)}
            />
            <div className="theme-preview dark-preview">Dark</div>
          </label>
          <label>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.value)}
            />
            <div className="theme-preview light-preview">Light</div>
          </label>
        </div>
      </div>
      <div className="setting-section">
        <h2>Accent Colors</h2>
        <div className="color-picker-container">
          <div className="color-picker">
            <label htmlFor="light-accent-picker">Light Mode</label>
            <input
              type="color"
              id="light-accent-picker"
              value={lightAccent}
              onChange={(e) => setLightAccent(e.target.value)}
            />
          </div>
          <div className="color-picker">
            <label htmlFor="dark-accent-picker">Dark Mode</label>
            <input
              type="color"
              id="dark-accent-picker"
              value={darkAccent}
              onChange={(e) => setDarkAccent(e.target.value)}
            />
          </div>
          <div className="color-picker">
            <label htmlFor="download-button-color-picker">Download Button</label>
            <input
              type="color"
              id="download-button-color-picker"
              value={downloadButtonColor}
              onChange={(e) => setDownloadButtonColor(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="setting-section">
        <h2>Downloads</h2>
        <div className="setting-row">
          <label htmlFor="download-location">Default Download Location</label>
          <button onClick={() => setDownloadLocation()}>
            {downloadLocation ? downloadLocation : 'Select a folder'}
          </button>
        </div>
      </div>
      <div className="setting-section libgen-access-card">
        <div className="libgen-access-header">
          <FiGlobe /> LibGen Access
        </div>
        {libgenAccessInfo ? (
          <>
            <div className="libgen-access-status-row">
              <span><strong>Current Mirror:</strong> <span className="current-method">{libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror ? libgenAccessInfo.currentMethod.mirror : 'None (auto-detect)'}</span></span>
              <span><strong>Last Error:</strong> <span className="last-error">{libgenAccessInfo.lastError || 'None'}</span></span>
            </div>
            <div className="libgen-access-row">
              <strong>Mirrors:</strong>
              {libgenAccessInfo.mirrors.map((mirror) => {
                const isCurrent = libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror === mirror;
                return (
                  <span
                    key={mirror}
                    className={'libgen-chip' + (isCurrent ? ' current' : '')}
                  >
                    {mirror}
                    <button className="remove-btn" title="Remove" onClick={() => handleRemoveMirror(mirror)}><FiX /></button>
                  </span>
                );
              })}
            </div>
            <div className="libgen-access-add-row">
              <input
                type="text"
                placeholder="Add new mirror (https://...)"
                value={newMirror}
                onChange={(e) => setNewMirror(e.target.value)}
              />
              <button onClick={handleAddMirror} title="Add Mirror"><FiPlus /></button>
            </div>
            <div className="libgen-access-divider" />
            <div className="libgen-access-actions">
              <button className="reset-button" onClick={handleTestAccess} disabled={testingAccess}>
                {testingAccess ? 'Testing...' : 'Test LibGen Access'}
              </button>
              <button className="reset-button" onClick={handleResetAccess} disabled={resettingAccess}>
                {resettingAccess ? 'Resetting...' : 'Reset Access Method'}
              </button>
            </div>
          </>
        ) : (
          <p>Loading LibGen access info...</p>
        )}
      </div>
      <div className="setting-section">
        <button className="reset-button" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
      <div className="setting-section version-info">
        <p>Version: {version}</p>
      </div>
    </div>
  );
};

export default Settings;
