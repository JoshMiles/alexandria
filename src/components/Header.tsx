import React from 'react';
import { FiBookOpen } from 'react-icons/fi';
import './Header.css';

interface HeaderProps {
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  return (
    <div className="header" onClick={onLogoClick}>
      <div className="logo-container">
        <FiBookOpen className="logo-icon" />
        <h1 className="logo-text">Alexandria</h1>
      </div>
    </div>
  );
};

export default Header;
