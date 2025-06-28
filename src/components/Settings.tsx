import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './Settings.css';

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

  useEffect(() => {
    const fetchVersion = async () => {
      const appVersion = await window.electron.getVersion();
      setVersion(appVersion);
    };
    fetchVersion();
  }, []);

  const libgenMirrors = [
    'libgen.li',
    'libgen.gs',
    'libgen.vg',
    'libgen.la',
    'libgen.bz',
    'libgen.gl',
  ];

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
      <div className="setting-section">
        <h2>Libgen Mirror</h2>
        <div className="setting-row">
          <label htmlFor="libgen-mirror">Select a mirror</label>
          <select
            id="libgen-mirror"
            value={libgenUrl}
            onChange={(e) => setLibgenUrl(e.target.value)}
          >
            {libgenMirrors.map((mirror) => (
              <option key={mirror} value={`https://${mirror}`}>
                {mirror}
              </option>
            ))}
          </select>
        </div>
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
