/**
 * Popup Component for School Co-Pilot Extension
 * Simple popup interface for quick actions
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

interface PopupState {
  isAuthenticated: boolean;
  selectedClass: string | null;
  isOnline: boolean;
  loading: boolean;
}

const Popup: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    isAuthenticated: false,
    selectedClass: null,
    isOnline: true,
    loading: true
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'check_auth',
        data: {}
      });

      setState({
        isAuthenticated: response.success && response.authenticated,
        selectedClass: response.session?.selectedClassId || null,
        isOnline: true,
        loading: false
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isOnline: false,
        loading: false
      }));
    }
  };

  const openSidePanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  if (state.loading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1 className="popup-title">School Co-Pilot</h1>
          <p className="popup-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1 className="popup-title">School Co-Pilot</h1>
        <p className="popup-subtitle">AI Study Assistant</p>
      </div>

      <div className={`popup-status ${state.isAuthenticated ? 'status-connected' : 'status-disconnected'}`}>
        {state.isAuthenticated ? (
          <>
            ✅ Connected
            {state.selectedClass && <div>Active class selected</div>}
          </>
        ) : (
          <>❌ Not authenticated</>
        )}
      </div>

      <div className="popup-actions">
        <button
          className="popup-button"
          onClick={openSidePanel}
          disabled={!state.isAuthenticated}
        >
          Open Assistant
        </button>

        <button
          className="popup-button secondary"
          onClick={openOptions}
        >
          Settings
        </button>

        {!state.isOnline && (
          <button
            className="popup-button secondary"
            onClick={checkStatus}
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
};

// Initialize popup
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}