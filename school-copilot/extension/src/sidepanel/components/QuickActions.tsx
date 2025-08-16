/**
 * Quick Actions Component
 * Action chips for common query types with accessibility features
 */

import React from 'react';

interface QuickActionsProps {
  onActionClick: (action: string) => void;
  disabled?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'summarize',
    label: 'Summarize',
    prompt: 'Please summarize the key points from the selected text.',
    icon: '📝',
    description: 'Get a summary of key points'
  },
  {
    id: 'define',
    label: 'Define',
    prompt: 'Please define and explain the selected term.',
    icon: '📖',
    description: 'Get definitions and explanations'
  },
  {
    id: 'explain',
    label: 'Explain Steps',
    prompt: 'Please explain this concept step by step.',
    icon: '🔍',
    description: 'Get step-by-step explanations'
  },
  {
    id: 'examples',
    label: 'Examples',
    prompt: 'Please provide examples to help me understand this concept.',
    icon: '💡',
    description: 'Get examples and illustrations'
  },
  {
    id: 'compare',
    label: 'Compare',
    prompt: 'Please compare and contrast these concepts.',
    icon: '⚖️',
    description: 'Compare different concepts'
  }
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onActionClick, disabled = false }) => {
  const handleActionClick = (action: QuickAction) => {
    if (!disabled) {
      onActionClick(action.prompt);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: QuickAction) => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      handleActionClick(action);
    }
  };

  return (
    <div className="quick-actions" role="toolbar" aria-label="Quick action buttons">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          className="quick-action-chip"
          onClick={() => handleActionClick(action)}
          onKeyDown={(e) => handleKeyDown(e, action)}
          disabled={disabled}
          aria-label={`${action.label}: ${action.description}`}
          title={action.description}
        >
          <span className="quick-action-icon" aria-hidden="true">
            {action.icon}
          </span>
          <span className="quick-action-label">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
};