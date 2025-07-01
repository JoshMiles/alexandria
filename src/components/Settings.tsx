import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import './Settings.css';
import { FiGlobe, FiPlus, FiX, FiZap, FiInfo } from 'react-icons/fi';
import LiveLogViewer from './LiveLogViewer';

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
    downloadLocation,
    setDownloadLocation,
    resetToDefaults,
  } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const [version, setVersion] = useState('');
  const [libgenAccessInfo, setLibgenAccessInfo] = useState<any>(null);
  const [resettingAccess, setResettingAccess] = useState(false);
  const [newMirror, setNewMirror] = useState('');
  const [testingAccess, setTestingAccess] = useState(false);

  // Theme customizer variables and helpers (moved inside component for access to t and theme)
  const THEME_VARIABLES = [
    { key: 'background', label: 'Background' },
    { key: 'background-light', label: 'Background Light' },
    { key: 'background-lighter', label: 'Background Lighter' },
    { key: 'foreground', label: 'Foreground' },
    { key: 'foreground-dark', label: 'Foreground Dark' },
    { key: 'accent', label: 'Accent' },
    { key: 'accent-hover', label: 'Accent Hover' },
    { key: 'accent-glow', label: 'Accent Glow' },
    { key: 'border', label: 'Border' },
    { key: 'border-light', label: 'Border Light' },
    { key: 'download-button-color', label: 'Download Button' },
    { key: 'download-button-hover-color', label: 'Download Button Hover' },
    { key: 'success', label: 'Success' },
    { key: 'error', label: 'Error' },
  ];

  const THEME_MODES = [
    { key: 'dark', label: t('settings.dark') },
    { key: 'light', label: t('settings.light') },
  ];

  const getThemeVar = (mode: string, variable: string) => {
    const root = document.documentElement;
    if (mode === theme) {
      return getComputedStyle(root).getPropertyValue(`--${variable}`)?.trim() || '';
    } else {
      const temp = document.createElement('div');
      temp.style.display = 'none';
      temp.setAttribute('data-theme', mode);
      document.body.appendChild(temp);
      const value = getComputedStyle(temp).getPropertyValue(`--${variable}`)?.trim() || '';
      document.body.removeChild(temp);
      return value;
    }
  };

  const setThemeVar = (mode: string, variable: string, value: string) => {
    const storageKey = `${mode}-${variable}`;
    localStorage.setItem(storageKey, value);
    if (mode === theme) {
      document.documentElement.style.setProperty(`--${variable}`, value);
    }
  };

  const resetThemeVars = (mode: string) => {
    THEME_VARIABLES.forEach(({ key }) => {
      const storageKey = `${mode}-${key}`;
      localStorage.removeItem(storageKey);
    });
    window.location.reload();
  };

  useEffect(() => {
    window.electron.getVersion().then(setVersion);
    window.electron.getLibgenAccessInfo().then(setLibgenAccessInfo);
  }, []);

  const handleResetAccess = async () => {
    setResettingAccess(true);
    await window.electron.resetLibgenAccessMethod();
    const info = await window.electron.getLibgenAccessInfo();
    setLibgenAccessInfo(info);
    setResettingAccess(false);
  };

  const handleAddMirror = async () => {
    if (newMirror.trim()) {
      const info = await window.electron.addLibgenMirror(newMirror.trim());
      setLibgenAccessInfo(info);
      setNewMirror('');
    }
  };

  const handleRemoveMirror = async (url: string) => {
    const info = await window.electron.removeLibgenMirror(url);
    setLibgenAccessInfo(info);
  };

  const handleTestAccess = async () => {
    setTestingAccess(true);
    try {
      const result = await window.electron.testLibgenAccess();
      if (result.success) {
        const info = await window.electron.getLibgenAccessInfo();
        setLibgenAccessInfo(info);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error testing LibGen access:', error);
    } finally {
      setTestingAccess(false);
    }
  };

  return (
    <div className="settings-root">
      <div className="settings-grid-container">
        <div className="settings-header-row">
          <button className="back-button top-left" onClick={onClose}>{t('app.back')}</button>
          <h1 className="settings-header-title">{t('settings.title')}</h1>
        </div>
        <div className="settings-grid">
          {/* Theme & Accent */}
          <div className="settings-panel settings-logger-panel">
            <div className="panel-header">
              <span className="panel-title">{t('settings.themeAndAccent')}</span>
              <span className="panel-tooltip" title="Change the app's theme and accent colors."><FiInfo /></span>
            </div>
            <div className="theme-options">
              {THEME_MODES.map(({ key, label }) => (
                <label key={key}>
                  <input type="radio" name="theme" value={key} checked={theme === key} onChange={e => setTheme(e.target.value)} />
                  <div className={`theme-preview ${key}-preview`}>{label}</div>
                </label>
              ))}
            </div>
            <div className="theme-divider" />
            <div className="theme-customizer-section">
              {THEME_MODES.map(({ key: mode, label }) => (
                <div key={mode} className="theme-card">
                  <div className="theme-card-header">{label} Theme</div>
                  <div className="theme-card-grid">
                    {THEME_VARIABLES.map(({ key: varKey, label: varLabel }) => (
                      <div className="theme-color-group" key={varKey}>
                        <label htmlFor={`${mode}-${varKey}-picker`} className="theme-color-label">{varLabel}</label>
                        <input
                          type="color"
                          id={`${mode}-${varKey}-picker`}
                          value={getThemeVar(mode, varKey) || '#000000'}
                          onChange={e => setThemeVar(mode, varKey, e.target.value)}
                          className="theme-color-input"
                        />
                      </div>
                    ))}
                  </div>
                  <button className="reset-button theme-reset-btn" onClick={() => resetThemeVars(mode)}>
                    Reset {label} Theme to Defaults
                  </button>
                </div>
              ))}
            </div>
          </div>
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
          {/* Downloads */}
          <div className="settings-panel settings-grid-item">
            <div className="panel-header">
              <span className="panel-title">{t('settings.downloads')}</span>
              <span className="panel-tooltip" title="Set your default download location."><FiInfo /></span>
            </div>
            <div className="setting-row">
              <label htmlFor="download-location">{t('settings.defaultDownloadLocation')}</label>
              <button onClick={() => setDownloadLocation()}>
                {downloadLocation ? downloadLocation : t('settings.selectFolder')}
              </button>
            </div>
          </div>
          {/* LibGen Access */}
          <div className="settings-panel settings-grid-item libgen-access-panel">
            <div className="panel-header">
              <span className="panel-title">{t('libgen.access')}</span>
              <span className="panel-tooltip" title="Manage LibGen mirrors and access."><FiInfo /></span>
            </div>
            {libgenAccessInfo ? (
              <>
                <div className="libgen-access-status-row">
                  <span><strong>{t('libgen.currentMirror')}:</strong> <span className="current-method">{libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror ? libgenAccessInfo.currentMethod.mirror : t('libgen.autoDetect')}</span></span>
                  <span><strong>{t('libgen.lastError')}:</strong> <span className="last-error">{libgenAccessInfo.lastError || t('libgen.none')}</span></span>
                </div>
                <div className="libgen-access-row">
                  <strong>{t('libgen.mirrors')}:</strong>
                  {libgenAccessInfo.mirrors.map((mirror: string) => {
                    const isCurrent = libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror === mirror;
                    return (
                      <span key={mirror} className={'libgen-chip' + (isCurrent ? ' current' : '')}>
                        {mirror}
                        <button className="remove-btn" title={t('libgen.remove')} onClick={() => handleRemoveMirror(mirror)}><FiX /></button>
                      </span>
                    );
                  })}
                </div>
                <div className="libgen-access-add-row">
                  <input type="text" placeholder={t('libgen.addMirrorPlaceholder')} value={newMirror} onChange={e => setNewMirror(e.target.value)} />
                  <button onClick={handleAddMirror} title={t('libgen.addMirror')}><FiPlus /></button>
                </div>
                <div className="libgen-access-divider" />
                <div className="libgen-access-actions">
                  <button className="reset-button" onClick={handleTestAccess} disabled={testingAccess}>
                    {testingAccess ? t('libgen.testing') : t('libgen.testAccess')}
                  </button>
                  <button className="reset-button" onClick={handleResetAccess} disabled={resettingAccess}>
                    {resettingAccess ? t('libgen.resetting') : t('libgen.resetAccessMethod')}
                  </button>
                </div>
              </>
            ) : (
              <p>{t('libgen.loadingAccessInfo')}</p>
            )}
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
          {/* Reset to Defaults */}
          <div className="settings-panel settings-grid-item">
            <div className="panel-header">
              <span className="panel-title">{t('settings.resetToDefaults')}</span>
              <span className="panel-tooltip" title="Reset all settings to their default values."><FiInfo /></span>
            </div>
            <button className="reset-button" onClick={resetToDefaults}>
              {t('settings.resetToDefaults')}
            </button>
          </div>
          {/* Version Info */}
          <div className="settings-panel settings-grid-item">
            <div className="panel-header">
              <span className="panel-title">{t('settings.version')}</span>
              <span className="panel-tooltip" title="App version."><FiInfo /></span>
            </div>
            <p>{version}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
