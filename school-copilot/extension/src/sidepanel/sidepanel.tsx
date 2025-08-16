/**
 * Side Panel Entry Point
 * Initializes React app for the Chrome extension side panel
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanel } from './components/SidePanel';

// Initialize the side panel
const initializeSidePanel = () => {
  const container = document.getElementById('root');
  
  if (!container) {
    console.error('Root container not found');
    return;
  }

  // Create React root and render the side panel
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <SidePanel />
    </React.StrictMode>
  );

  // Log successful initialization
  console.log('School Co-Pilot side panel initialized');
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSidePanel);
} else {
  initializeSidePanel();
}

// Handle extension messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Side panel received message:', message.type);
  
  // Handle specific side panel messages
  switch (message.type) {
    case 'focus_input':
      // Focus the input field
      const inputField = document.querySelector('.input-field') as HTMLTextAreaElement;
      if (inputField) {
        inputField.focus();
      }
      sendResponse({ success: true });
      break;
      
    case 'clear_chat':
      // This would be handled by the SidePanel component
      // We'll dispatch a custom event that the component can listen to
      window.dispatchEvent(new CustomEvent('clearChat'));
      sendResponse({ success: true });
      break;
      
    default:
      // Let the SidePanel component handle other messages
      break;
  }
});

// Handle window focus/blur for animations
let isWindowFocused = true;

window.addEventListener('focus', () => {
  isWindowFocused = true;
  document.documentElement.setAttribute('data-window-focused', 'true');
});

window.addEventListener('blur', () => {
  isWindowFocused = false;
  document.documentElement.setAttribute('data-window-focused', 'false');
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + K to focus input
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    const inputField = document.querySelector('.input-field') as HTMLTextAreaElement;
    if (inputField) {
      inputField.focus();
    }
  }
  
  // Escape to clear input or close error messages
  if (event.key === 'Escape') {
    const inputField = document.querySelector('.input-field') as HTMLTextAreaElement;
    const errorDismiss = document.querySelector('.error-dismiss-button') as HTMLButtonElement;
    
    if (inputField && inputField === document.activeElement && inputField.value) {
      inputField.value = '';
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (errorDismiss) {
      errorDismiss.click();
    }
  }
});

// Export for testing
export { initializeSidePanel };