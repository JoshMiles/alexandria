import React from 'react';
import { FiBookOpen } from 'react-icons/fi';
import './Header.css';

interface HeaderProps {
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const isMac = window.electron.platform === 'darwin';

  return (
    <div className={`header ${isMac ? 'mac-header' : ''}`} onClick={onLogoClick}>
      <div className="logo-container">
        <h1 className="logo-text">Alexandria</h1>
      </div>
    </div>
  );
};

export default Header;
