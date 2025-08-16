/**
 * Accessibility Settings Component
 * Provides interface for managing accessibility preferences
 */

import React, { useState } from 'react';
import { 
  Settings, 
  Eye, 
  Type, 
  MousePointer, 
  Keyboard,
  Volume2,
  Minimize2,
  RotateCcw,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface AccessibilitySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const settingsConfig = [
  {
    key: 'reduceMotion' as const,
    title: 'Reduce Motion',
    description: 'Disable animations and transitions for a calmer experience',
    icon: Minimize2,
    category: 'Visual',
    helpText: 'Reduces or eliminates motion-based animations that might cause discomfort or distraction.'
  },
  {
    key: 'highContrast' as const,
    title: 'High Contrast',
    description: 'Increase contrast for better visibility',
    icon: Eye,
    category: 'Visual',
    helpText: 'Enhances color contrast to make text and interface elements more distinguishable.'
  },
  {
    key: 'largeText' as const,
    title: 'Large Text',
    description: 'Increase text size for better readability',
    icon: Type,
    category: 'Visual',
    helpText: 'Makes all text larger and easier to read.'
  },
  {
    key: 'screenReaderMode' as const,
    title: 'Screen Reader Mode',
    description: 'Optimize interface for screen readers',
    icon: Volume2,
    category: 'Assistive Technology',
    helpText: 'Provides additional context and descriptions for screen reader users.'
  },
  {
    key: 'keyboardNavigation' as const,
    title: 'Enhanced Keyboard Navigation',
    description: 'Improve keyboard-only navigation',
    icon: Keyboard,
    category: 'Navigation',
    helpText: 'Enhances keyboard navigation with better focus management and shortcuts.'
  },
  {
    key: 'focusIndicators' as const,
    title: 'Enhanced Focus Indicators',
    description: 'Make focus indicators more visible',
    icon: MousePointer,
    category: 'Navigation',
    helpText: 'Makes it easier to see which element currently has keyboard focus.'
  },
  {
    key: 'announceChanges' as const,
    title: 'Announce Changes',
    description: 'Announce interface changes to screen readers',
    icon: Volume2,
    category: 'Assistive Technology',
    helpText: 'Provides audio feedback when interface elements change or update.'
  },
  {
    key: 'simplifiedInterface' as const,
    title: 'Simplified Interface',
    description: 'Reduce visual complexity for easier navigation',
    icon: Minimize2,
    category: 'Visual',
    helpText: 'Simplifies the interface by reducing visual clutter and complexity.'
  }
];

const categories = ['Visual', 'Navigation', 'Assistive Technology'];

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings, announceToScreenReader } = useAccessibility();
  const [activeCategory, setActiveCategory] = useState('Visual');
  const [showHelp, setShowHelp] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSettingChange = (key: keyof typeof settings, value: boolean) => {
    updateSetting(key, value);
  };

  const handleReset = () => {
    if (window.confirm('Reset all accessibility settings to defaults?')) {
      resetSettings();
      announceToScreenReader('All accessibility settings have been reset to defaults');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  const filteredSettings = settingsConfig.filter(setting => setting.category === activeCategory);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600" aria-hidden="true" />
            <h2 id="accessibility-settings-title" className="text-xl font-semibold text-gray-900">
              Accessibility Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
            aria-label="Close accessibility settings"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex h-96">
          {/* Category Navigation */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-50">
            <nav className="p-4" role="tablist" aria-label="Accessibility categories">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    activeCategory === category
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  role="tab"
                  aria-selected={activeCategory === category}
                  aria-controls={`category-${category.toLowerCase().replace(' ', '-')}`}
                >
                  {category}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Panel */}
          <div className="flex-1 overflow-y-auto">
            <div 
              className="p-6"
              role="tabpanel"
              id={`category-${activeCategory.toLowerCase().replace(' ', '-')}`}
              aria-labelledby={`tab-${activeCategory.toLowerCase().replace(' ', '-')}`}
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">{activeCategory} Settings</h3>
              
              <div className="space-y-4">
                {filteredSettings.map((setting) => {
                  const Icon = setting.icon;
                  const isEnabled = settings[setting.key];
                  
                  return (
                    <div key={setting.key} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <Icon 
                            className="w-5 h-5 text-gray-600 mt-0.5" 
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-medium text-gray-900">
                                {setting.title}
                              </h4>
                              <button
                                onClick={() => setShowHelp(showHelp === setting.key ? null : setting.key)}
                                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                aria-label={`Help for ${setting.title}`}
                              >
                                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {setting.description}
                            </p>
                            
                            {showHelp === setting.key && (
                              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                                {setting.helpText}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleSettingChange(setting.key, !isEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                            role="switch"
                            aria-checked={isEnabled}
                            aria-labelledby={`label-${setting.key}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="sr-only" id={`label-${setting.key}`}>
                            {setting.title} is {isEnabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Settings are automatically saved
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
              Reset All
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Check className="w-4 h-4 mr-2" aria-hidden="true" />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};