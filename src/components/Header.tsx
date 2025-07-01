import React from 'react';
import { FiBookOpen } from 'react-icons/fi';
import { useI18n } from '../contexts/I18nContext';
import './Header.css';

interface HeaderProps {
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const isMac = window.electron.platform === 'darwin';
  const { t } = useI18n();

  return (
    <div className={`header ${isMac ? 'mac-header' : ''}`} onClick={onLogoClick}>
      <div className="logo-container">
        <h1 className="logo-text">{t('app.name')}</h1>
      </div>
    </div>
  );
};

export default Header;
