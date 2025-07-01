import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultSettings = {
  theme: 'dark',
  lightAccent: '#a052e2',
  darkAccent: '#8a2be2',
  downloadButtonColor: '#2e8b57',
  libgenUrl: 'https://libgen.li',
  downloadLocation: '',
};

const ThemeContext = createContext({
  ...defaultSettings,
  setTheme: (theme: string) => {},
  setLightAccent: (color: string) => {},
  setDarkAccent: (color: string) => {},
  setDownloadButtonColor: (color: string) => {},
  setLibgenUrl: (url: string) => {},
  setDownloadLocation: () => {},
  resetToDefaults: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || defaultSettings.theme);
  const [lightAccent, setLightAccent] = useState(localStorage.getItem('lightAccent') || defaultSettings.lightAccent);
  const [darkAccent, setDarkAccent] = useState(localStorage.getItem('darkAccent') || defaultSettings.darkAccent);
  const [downloadButtonColor, setDownloadButtonColor] = useState(localStorage.getItem('downloadButtonColor') || defaultSettings.downloadButtonColor);
  const [libgenUrl, setLibgenUrl] = useState(localStorage.getItem('libgenUrl') || defaultSettings.libgenUrl);
  const [downloadLocation, setDownloadLocationState] = useState(localStorage.getItem('downloadLocation') || defaultSettings.downloadLocation);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Apply all custom theme variables for the current theme
    const THEME_VARIABLES = [
      'background', 'background-light', 'background-lighter', 'foreground', 'foreground-dark', 'accent', 'accent-hover', 'accent-glow', 'border', 'border-light', 'download-button-color', 'download-button-hover-color', 'success', 'error'
    ];
    THEME_VARIABLES.forEach((key) => {
      const storageKey = `${theme}-${key}`;
      const value = localStorage.getItem(storageKey);
      if (value) {
        document.documentElement.style.setProperty(`--${key}`, value);
      }
    });
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-light', lightAccent);
    localStorage.setItem('lightAccent', lightAccent);
  }, [lightAccent]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-dark', darkAccent);
    localStorage.setItem('darkAccent', darkAccent);
  }, [darkAccent]);

  useEffect(() => {
    document.documentElement.style.setProperty('--download-button-color', downloadButtonColor);
    localStorage.setItem('downloadButtonColor', downloadButtonColor);
  }, [downloadButtonColor]);

  useEffect(() => {
    localStorage.setItem('libgenUrl', libgenUrl);
  }, [libgenUrl]);

  useEffect(() => {
    localStorage.setItem('downloadLocation', downloadLocation);
  }, [downloadLocation]);

  useEffect(() => {
    // On app load, apply all custom theme variables for the current theme
    const THEME_VARIABLES = [
      'background', 'background-light', 'background-lighter', 'foreground', 'foreground-dark', 'accent', 'accent-hover', 'accent-glow', 'border', 'border-light', 'download-button-color', 'download-button-hover-color', 'success', 'error'
    ];
    THEME_VARIABLES.forEach((key) => {
      const storageKey = `${theme}-${key}`;
      const value = localStorage.getItem(storageKey);
      if (value) {
        document.documentElement.style.setProperty(`--${key}`, value);
      }
    });
  }, []);

  const setDownloadLocation = async () => {
    const location = await window.electron.getDownloadLocation();
    if (location) {
      setDownloadLocationState(location);
    }
  };

  const resetToDefaults = () => {
    setTheme(defaultSettings.theme);
    setLightAccent(defaultSettings.lightAccent);
    setDarkAccent(defaultSettings.darkAccent);
    setDownloadButtonColor(defaultSettings.downloadButtonColor);
    setLibgenUrl(defaultSettings.libgenUrl);
    setDownloadLocationState(defaultSettings.downloadLocation);
  };

  return (
    <ThemeContext.Provider
      value={{
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
