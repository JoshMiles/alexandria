import React, { useEffect } from 'react';
import './Notification.css';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    if (type !== 'info') {
      const timer = setTimeout(onClose, 5000); // Auto-close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [onClose, type]);

  return (
    <div className={`notification ${type}`}>
      <p>{message}</p>
      <button className="close-button" onClick={onClose}>&times;</button>
    </div>
  );
};

export default Notification;
