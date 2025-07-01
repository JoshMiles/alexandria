import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
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
  
  const { t, language, setLanguage, availableLanguages } = useI18n();

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
          {t('app.back')}
        </button>
        <h1>{t('settings.title')}</h1>
      </div>
      <div className="setting-section">
        <h2>{t('settings.theme')}</h2>
        <div className="theme-options">
          <label>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.value)}
            />
            <div className="theme-preview dark-preview">{t('settings.dark')}</div>
          </label>
          <label>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.value)}
            />
            <div className="theme-preview light-preview">{t('settings.light')}</div>
          </label>
        </div>
      </div>
      <div className="setting-section">
        <h2>{t('settings.accentColors')}</h2>
        <div className="color-picker-container">
          <div className="color-picker">
            <label htmlFor="light-accent-picker">{t('settings.lightMode')}</label>
            <input
              type="color"
              id="light-accent-picker"
              value={lightAccent}
              onChange={(e) => setLightAccent(e.target.value)}
            />
          </div>
          <div className="color-picker">
            <label htmlFor="dark-accent-picker">{t('settings.darkMode')}</label>
            <input
              type="color"
              id="dark-accent-picker"
              value={darkAccent}
              onChange={(e) => setDarkAccent(e.target.value)}
            />
          </div>
          <div className="color-picker">
            <label htmlFor="download-button-color-picker">{t('settings.downloadButton')}</label>
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
        <h2>{t('settings.downloads')}</h2>
        <div className="setting-row">
          <label htmlFor="download-location">{t('settings.defaultDownloadLocation')}</label>
          <button onClick={() => setDownloadLocation()}>
            {downloadLocation ? downloadLocation : t('settings.selectFolder')}
          </button>
        </div>
      </div>
      
      <div className="setting-section">
        <h2>{t('settings.language')}</h2>
        <div className="language-options">
          {Object.entries(availableLanguages).map(([code, lang]) => (
            <label key={code} className="language-option">
              <input
                type="radio"
                name="language"
                value={code}
                checked={language === code}
                onChange={(e) => setLanguage(e.target.value)}
              />
              <div className="language-preview">
                <span className="language-flag">{lang.flag}</span>
                <span className="language-name">{lang.name}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="setting-section libgen-access-card">
        <div className="libgen-access-header">
          <FiGlobe /> {t('libgen.access')}
        </div>
        {libgenAccessInfo ? (
          <>
            <div className="libgen-access-status-row">
              <span><strong>{t('libgen.currentMirror')}:</strong> <span className="current-method">{libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror ? libgenAccessInfo.currentMethod.mirror : t('libgen.autoDetect')}</span></span>
              <span><strong>{t('libgen.lastError')}:</strong> <span className="last-error">{libgenAccessInfo.lastError || t('libgen.none')}</span></span>
            </div>
            <div className="libgen-access-row">
              <strong>{t('libgen.mirrors')}:</strong>
              {libgenAccessInfo.mirrors.map((mirror) => {
                const isCurrent = libgenAccessInfo.currentMethod && libgenAccessInfo.currentMethod.mirror === mirror;
                return (
                  <span
                    key={mirror}
                    className={'libgen-chip' + (isCurrent ? ' current' : '')}
                  >
                    {mirror}
                    <button className="remove-btn" title={t('libgen.remove')} onClick={() => handleRemoveMirror(mirror)}><FiX /></button>
                  </span>
                );
              })}
            </div>
            <div className="libgen-access-add-row">
              <input
                type="text"
                placeholder={t('libgen.addMirrorPlaceholder')}
                value={newMirror}
                onChange={(e) => setNewMirror(e.target.value)}
              />
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
      <div className="setting-section">
        <button className="reset-button" onClick={resetToDefaults}>
          {t('settings.resetToDefaults')}
        </button>
      </div>
      <div className="setting-section version-info">
        <p>{t('settings.version')}: {version}</p>
      </div>
    </div>
  );
};

export default Settings;
