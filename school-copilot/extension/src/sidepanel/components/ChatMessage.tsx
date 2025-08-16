/**
 * Chat Message Component
 * Displays individual messages with citations and accessibility features
 */

import React from 'react';
import { Message } from './SidePanel';
import { Citation } from '@shared/types';
import { CitationPanel } from './CitationPanel';

interface ChatMessageProps {
  message: Message;
  onCitationClick: (citation: Citation) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onCitationClick }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (message.isLoading) {
    return (
      <div className="message assistant" role="status" aria-label="Assistant is typing">
        <div className="message-bubble">
          <div className="loading-indicator">
            <span>Thinking</span>
            <div className="loading-dots">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${message.type}`} role="article">
      <div className="message-bubble">
        {message.error ? (
          <div className="error-content">
            <p>{message.content}</p>
            <details className="error-details">
              <summary>Error details</summary>
              <p>{message.error}</p>
            </details>
          </div>
        ) : (
          <div className="message-content">
            {message.content.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )}
      </div>
      
      <div className="message-timestamp" aria-label={`Sent at ${formatTime(message.timestamp)}`}>
        {formatTime(message.timestamp)}
      </div>

      {message.citations && message.citations.length > 0 && (
        <CitationPanel
          citations={message.citations}
          onCitationClick={onCitationClick}
        />
      )}
    </div>
  );
};