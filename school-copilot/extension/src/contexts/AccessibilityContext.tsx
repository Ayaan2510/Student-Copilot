/**
 * Accessibility Context
 * Manages accessibility settings and preferences across the extension
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';

export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  announceChanges: boolean;
  simplifiedInterface: boolean;
}

interface AccessibilityState extends AccessibilitySettings {
  isLoading: boolean;
}

type AccessibilityAction = 
  | { type: 'SET_SETTING'; key: keyof AccessibilitySettings; value: boolean }
  | { type: 'LOAD_SETTINGS'; settings: AccessibilitySettings }
  | { type: 'RESET_SETTINGS' }
  | { type: 'SET_LOADING'; loading: boolean };

const defaultSettings: AccessibilitySettings = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderMode: false,
  keyboardNavigation: true,
  focusIndicators: true,
  announceChanges: true,
  simplifiedInterface: false,
};

const initialState: AccessibilityState = {
  ...defaultSettings,
  isLoading: true,
};

function accessibilityReducer(state: AccessibilityState, action: AccessibilityAction): AccessibilityState {
  switch (action.type) {
    case 'SET_SETTING':
      return {
        ...state,
        [action.key]: action.value,
      };
    case 'LOAD_SETTINGS':
      return {
        ...state,
        ...action.settings,
        isLoading: false,
      };
    case 'RESET_SETTINGS':
      return {
        ...defaultSettings,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.loading,
      };
    default:
      return state;
  }
}

interface AccessibilityContextType {
  settings: AccessibilityState;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
  resetSettings: () => void;
  announceToScreenReader: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(accessibilityReducer, initialState);

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await chrome.storage.sync.get('accessibilitySettings');
        if (stored.accessibilitySettings) {
          dispatch({ type: 'LOAD_SETTINGS', settings: stored.accessibilitySettings });
        } else {
          // Check system preferences
          const systemPreferences = await detectSystemPreferences();
          const mergedSettings = { ...defaultSettings, ...systemPreferences };
          dispatch({ type: 'LOAD_SETTINGS', settings: mergedSettings });
          await chrome.storage.sync.set({ accessibilitySettings: mergedSettings });
        }
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
        dispatch({ type: 'LOAD_SETTINGS', settings: defaultSettings });
      }
    };

    loadSettings();
  }, []);

  // Apply settings to document when they change
  useEffect(() => {
    if (!state.isLoading) {
      applyAccessibilitySettings(state);
      saveSettings(state);
    }
  }, [state]);

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    dispatch({ type: 'SET_SETTING', key, value });
    
    // Announce changes to screen readers
    if (state.announceChanges) {
      const settingName = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      announceToScreenReader(`${settingName} ${value ? 'enabled' : 'disabled'}`);
    }
  };

  const resetSettings = () => {
    dispatch({ type: 'RESET_SETTINGS' });
    announceToScreenReader('Accessibility settings reset to defaults');
  };

  const announceToScreenReader = (message: string) => {
    // Create a live region for screen reader announcements
    let liveRegion = document.getElementById('accessibility-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'accessibility-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
    
    // Clear and set new message
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion!.textContent = message;
    }, 100);
  };

  const value: AccessibilityContextType = {
    settings: state,
    updateSetting,
    resetSettings,
    announceToScreenReader,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// Helper function to detect system accessibility preferences
async function detectSystemPreferences(): Promise<Partial<AccessibilitySettings>> {
  const preferences: Partial<AccessibilitySettings> = {};

  // Check for prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    preferences.reduceMotion = true;
  }

  // Check for prefers-contrast
  if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
    preferences.highContrast = true;
  }

  // Check for prefers-color-scheme
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    preferences.highContrast = true;
  }

  return preferences;
}

// Helper function to apply accessibility settings to the document
function applyAccessibilitySettings(settings: AccessibilitySettings) {
  const root = document.documentElement;

  // Apply CSS custom properties for accessibility settings
  root.style.setProperty('--reduce-motion', settings.reduceMotion ? '1' : '0');
  root.style.setProperty('--high-contrast', settings.highContrast ? '1' : '0');
  root.style.setProperty('--large-text', settings.largeText ? '1' : '0');
  root.style.setProperty('--focus-indicators', settings.focusIndicators ? '1' : '0');

  // Add/remove CSS classes
  root.classList.toggle('reduce-motion', settings.reduceMotion);
  root.classList.toggle('high-contrast', settings.highContrast);
  root.classList.toggle('large-text', settings.largeText);
  root.classList.toggle('screen-reader-mode', settings.screenReaderMode);
  root.classList.toggle('simplified-interface', settings.simplifiedInterface);

  // Set ARIA attributes
  document.body.setAttribute('data-reduce-motion', settings.reduceMotion.toString());
  document.body.setAttribute('data-high-contrast', settings.highContrast.toString());
  document.body.setAttribute('data-large-text', settings.largeText.toString());
}

// Helper function to save settings
async function saveSettings(settings: AccessibilitySettings) {
  try {
    await chrome.storage.sync.set({ accessibilitySettings: settings });
  } catch (error) {
    console.error('Failed to save accessibility settings:', error);
  }
}