import React from 'react';
import { FiMinimize2, FiMaximize2, FiX } from 'react-icons/fi';
import './TitleBar.css';

const TitleBar = () => {
  const handleMinimize = () => {
    window.electron.minimize();
  };

  const handleMaximize = () => {
    window.electron.maximize();
  };

  const handleClose = () => {
    window.electron.close();
  };

  // On macOS, the traffic lights are handled by the OS due to titleBarStyle: 'hidden'
  // We just need to make sure there's space for them.
  if (window.electron.platform === 'darwin') {
    return <div className="title-bar macos-title-bar"></div>;
  }

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region"></div>
      <div className="title-bar-controls">
        <button onClick={handleMinimize} className="title-bar-button">
          <FiMinimize2 />
        </button>
        <button onClick={handleMaximize} className="title-bar-button">
          <FiMaximize2 />
        </button>
        <button onClick={handleClose} className="title-bar-button close-button">
          <FiX />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
