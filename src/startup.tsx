import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './startup.css';

const Startup = () => {
  const [message, setMessage] = useState('Checking for updates...');

  useEffect(() => {
    window.electron.on('update-message', (newMessage) => {
      setMessage(newMessage);
    });
  }, []);

  return (
    <div className="startup-container">
      <h1>Alexandria</h1>
      <p>{message}</p>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Startup />);
