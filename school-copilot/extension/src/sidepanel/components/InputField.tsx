/**
 * Input Field Component
 * Text input with send button and accessibility features
 */

import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const InputField = forwardRef<HTMLTextAreaElement, InputFieldProps>(({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask a question...",
  maxLength = 1000
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Expose textarea ref to parent
  useImperativeHandle(ref, () => textareaRef.current!, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled;
  const remainingChars = maxLength - value.length;

  return (
    <div className="input-container">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          className="input-field"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          aria-label="Type your question"
          aria-describedby="input-help char-count"
        />
        
        {remainingChars < 100 && (
          <div 
            id="char-count" 
            className={`char-count ${remainingChars < 20 ? 'warning' : ''}`}
            aria-live="polite"
          >
            {remainingChars} characters remaining
          </div>
        )}
      </div>
      
      <button
        className="send-button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label="Send message"
        title="Send message (Enter)"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M2.94 6.94a1.5 1.5 0 012.12 0L10 11.88l4.94-4.94a1.5 1.5 0 112.12 2.12l-6 6a1.5 1.5 0 01-2.12 0l-6-6a1.5 1.5 0 010-2.12z" transform="rotate(-90 10 10)"/>
        </svg>
      </button>
      
      <div id="input-help" className="sr-only">
        Type your question and press Enter to send, or Shift+Enter for a new line. Maximum {maxLength} characters.
      </div>
    </div>
  );
});