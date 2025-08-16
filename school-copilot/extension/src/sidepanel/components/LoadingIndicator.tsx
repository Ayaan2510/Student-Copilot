/**
 * Loading Indicator Component
 * Shows loading state with accessibility features
 */

import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = "Thinking...",
  size = 'medium'
}) => {
  return (
    <div 
      className={`loading-indicator loading-${size}`} 
      role="status" 
      aria-live="polite"
      aria-label={message}
    >
      <span className="loading-message">{message}</span>
      <div className="loading-dots" aria-hidden="true">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
      <span className="sr-only">Loading, please wait</span>
    </div>
  );
};