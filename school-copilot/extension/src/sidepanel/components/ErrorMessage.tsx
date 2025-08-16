/**
 * Error Message Component
 * Displays error messages with dismiss functionality
 */

import React from 'react';

interface ErrorMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  type = 'error',
  onDismiss,
  actionText,
  onAction
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'error':
      default:
        return '❌';
    }
  };

  const getAriaLabel = () => {
    switch (type) {
      case 'warning':
        return 'Warning message';
      case 'info':
        return 'Information message';
      case 'error':
      default:
        return 'Error message';
    }
  };

  return (
    <div 
      className={`error-message error-${type}`} 
      role="alert"
      aria-label={getAriaLabel()}
    >
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          {getIcon()}
        </div>
        
        <div className="error-text">
          {message}
        </div>
        
        <div className="error-actions">
          {actionText && onAction && (
            <button
              className="error-action-button"
              onClick={onAction}
              aria-label={actionText}
            >
              {actionText}
            </button>
          )}
          
          {onDismiss && (
            <button
              className="error-dismiss-button"
              onClick={onDismiss}
              aria-label="Dismiss error message"
              title="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};