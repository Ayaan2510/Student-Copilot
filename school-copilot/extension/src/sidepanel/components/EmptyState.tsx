/**
 * Empty State Component
 * Displays when no messages are present
 */

import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction
}) => {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      
      <h2 className="empty-state-title">
        {title}
      </h2>
      
      <p className="empty-state-description">
        {description}
      </p>
      
      {actionText && onAction && (
        <button
          className="empty-state-action"
          onClick={onAction}
          aria-label={actionText}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};