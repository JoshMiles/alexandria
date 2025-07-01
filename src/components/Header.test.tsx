import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../contexts/I18nContext';
import Header from './Header';

// Mock the electron API
if (typeof window.electron === 'undefined') {
  window.electron = {
    platform: 'darwin',
    getVersion: jest.fn(),
    search: jest.fn(),
    openLink: jest.fn(),
    on: jest.fn(),
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
    download: jest.fn(),
    cancelDownload: jest.fn(),
    openFile: jest.fn(),
    openFolder: jest.fn(),
    clearDownloads: jest.fn(),
    getDownloads: jest.fn(),
    onDownloadsUpdated: jest.fn(),
    onDownloadProgress: jest.fn(),
    getDownloadLocation: jest.fn(),
    getLibgenAccessInfo: jest.fn(),
    resetLibgenAccessMethod: jest.fn(),
    addLibgenMirror: jest.fn(),
    removeLibgenMirror: jest.fn(),
    testLibgenAccess: jest.fn(),
  };
}

describe('Header', () => {
  it('renders the logo and title', () => {
    render(
      <I18nProvider>
        <Header onLogoClick={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByText('Alexandria')).not.toBeNull();
  });
});
