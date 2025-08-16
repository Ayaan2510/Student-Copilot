/**
 * Main Side Panel Component for School Co-Pilot
 * Student-facing chat interface with comprehensive accessibility features
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExtensionMessage, QueryRequest, QueryResponse, ExtensionSettings, Citation } from '@shared/types';
import { ChatMessage } from './ChatMessage';
import { CitationPanel } from './CitationPanel';
import { ClassSelector } from './ClassSelector';
import { QuickActions } from './QuickActions';
import { InputField } from './InputField';
import { EmptyState } from './EmptyState';
import { LoadingIndicator } from './LoadingIndicator';
import { ErrorMessage } from './ErrorMessage';
import { AccessibilityProvider, useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibilitySettings } from '../../components/AccessibilitySettings';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { runAccessibilityTest, AccessibilityMonitor } from '../../utils/accessibilityTesting';
import { Settings, Volume2, VolumeX } from 'lucide-react';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  isLoading?: boolean;
  error?: string;
}

// Use Citation from shared types
import type { Citation } from '@shared/types';

export interface Class {
  id: string;
  name: string;
  enabled: boolean;
}

// Main SidePanel component wrapped with accessibility provider
export const SidePanel: React.FC = () => {
  return (
    <AccessibilityProvider>
      <SidePanelContent />
    </AccessibilityProvider>
  );
};

// Internal component with accessibility features
const SidePanelContent: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  // Accessibility context
  const { settings: a11ySettings, announceToScreenReader } = useAccessibility();

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const accessibilityMonitor = useRef<AccessibilityMonitor | null>(null);

  // Keyboard navigation
  const keyboardNav = useKeyboardNavigation(containerRef, {
    enableArrowKeys: true,
    enableHomeEnd: true,
    trapFocus: false,
    onEscape: () => {
      if (showAccessibilitySettings) {
        setShowAccessibilitySettings(false);
      } else if (error) {
        setError(null);
      }
    }
  });

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize component
  useEffect(() => {
    initializePanel();
    setupMessageListeners();
    initializeAccessibility();
    
    return () => {
      // Cleanup listeners
      chrome.runtime.onMessage.removeListener(handleExtensionMessage);
      
      // Cleanup accessibility monitor
      if (accessibilityMonitor.current) {
        accessibilityMonitor.current.stop();
      }
    };
  }, []);

  // Initialize accessibility features
  const initializeAccessibility = async () => {
    // Set up accessibility monitoring in development
    if (process.env.NODE_ENV === 'development') {
      accessibilityMonitor.current = new AccessibilityMonitor((violations) => {
        console.warn('Accessibility violations detected:', violations);
      });
      
      accessibilityMonitor.current.start({
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        interval: 10000 // Check every 10 seconds
      });
    }

    // Add skip link
    addSkipLink();
    
    // Set up speech synthesis if available
    if ('speechSynthesis' in window) {
      setSpeechEnabled(true);
    }

    // Announce initial state to screen readers
    setTimeout(() => {
      announceToScreenReader('School Co-Pilot loaded. Use Tab to navigate, or press Alt+S for accessibility settings.');
    }, 1000);
  };

  // Add skip link for keyboard navigation
  const addSkipLink = () => {
    const existingSkipLink = document.getElementById('skip-to-main');
    if (existingSkipLink) return;

    const skipLink = document.createElement('a');
    skipLink.id = 'skip-to-main';
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.focus();
        announceToScreenReader('Skipped to main content');
      }
    });

    document.body.insertBefore(skipLink, document.body.firstChild);
  };

  // Initialize panel data
  const initializePanel = async () => {
    try {
      // Check authentication status
      const authResponse = await sendMessage({ type: 'check_auth', data: {} });
      if (authResponse.success && authResponse.authenticated) {
        setIsAuthenticated(true);
        
        // Load settings
        const settingsResponse = await sendMessage({ type: 'get_settings', data: {} });
        if (settingsResponse.success) {
          setSettings(settingsResponse.data);
          setSelectedClass(settingsResponse.data.selectedClassId);
        }
        
        // Load classes
        await loadClasses();
      } else {
        setError('Please log in to use School Co-Pilot');
      }
    } catch (error) {
      console.error('Failed to initialize panel:', error);
      setError('Failed to initialize. Please try refreshing.');
    }
  };

  // Load available classes
  const loadClasses = async () => {
    try {
      const response = await sendMessage({ type: 'get_classes', data: {} });
      if (response.success) {
        setClasses(response.data || []);
        
        // Auto-select first enabled class if none selected
        if (!selectedClass && response.data?.length > 0) {
          const firstEnabled = response.data.find((cls: Class) => cls.enabled);
          if (firstEnabled) {
            setSelectedClass(firstEnabled.id);
            await updateSelectedClass(firstEnabled.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  // Set up message listeners
  const setupMessageListeners = () => {
    chrome.runtime.onMessage.addListener(handleExtensionMessage);
  };

  // Handle messages from extension
  const handleExtensionMessage = (message: ExtensionMessage) => {
    switch (message.type) {
      case 'quick_action_result':
        handleQuickActionResult(message.data);
        break;
      case 'auth_required':
        setIsAuthenticated(false);
        setError('Authentication required. Please log in.');
        break;
      case 'settings_update':
        setSettings(message.data);
        break;
      default:
        break;
    }
  };

  // Handle quick action results
  const handleQuickActionResult = (data: any) => {
    const { action, result, text } = data;
    
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: `${action.charAt(0).toUpperCase() + action.slice(1)}: "${text}"`,
      timestamp: new Date()
    };
    
    // Add assistant response
    const assistantMessage: Message = {
      id: generateId(),
      type: 'assistant',
      content: result.data?.answer || 'Sorry, I couldn\'t process that request.',
      timestamp: new Date(),
      citations: result.data?.citations || []
    };
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
  };

  // Send message to extension
  const sendMessage = async (message: ExtensionMessage): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  };

  // Handle class selection change
  const handleClassChange = async (classId: string) => {
    setSelectedClass(classId);
    await updateSelectedClass(classId);
    
    // Clear messages when switching classes
    setMessages([]);
    setError(null);
  };

  // Update selected class in settings
  const updateSelectedClass = async (classId: string) => {
    try {
      await sendMessage({
        type: 'save_settings',
        data: { selectedClassId: classId }
      });
    } catch (error) {
      console.error('Failed to update selected class:', error);
    }
  };

  // Handle quick action click
  const handleQuickAction = (action: string) => {
    const prompts = {
      summarize: 'Please summarize the key points from the selected text.',
      define: 'Please define and explain the selected term.',
      explain: 'Please explain this concept step by step.'
    };
    
    setCurrentInput(prompts[action as keyof typeof prompts] || action);
    inputRef.current?.focus();
  };

  // Handle message submission with accessibility announcements
  const handleSubmit = async (content: string) => {
    if (!content.trim() || !selectedClass || isLoading) return;
    
    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date()
    };
    
    const loadingMessage: Message = {
      id: generateId(),
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setCurrentInput('');
    setIsLoading(true);
    setError(null);

    // Announce to screen readers
    if (a11ySettings.announceChanges) {
      announceToScreenReader('Question submitted. Waiting for response.');
    }

    // Speak the question if speech is enabled
    if (speechEnabled && a11ySettings.screenReaderMode) {
      speakText(`You asked: ${content.trim()}`);
    }
    
    try {
      const queryRequest: QueryRequest = {
        studentId: 'current-user', // Will be populated by service worker
        classId: selectedClass,
        question: content.trim(),
        timestamp: new Date(),
        sessionId: generateSessionId()
      };
      
      const response = await sendMessage({
        type: 'submit_query',
        data: queryRequest
      });
      
      // Remove loading message and add response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== loadingMessage.id);
        
        if (response.success && response.data) {
          const assistantMessage: Message = {
            id: generateId(),
            type: 'assistant',
            content: response.data.answer || 'I couldn\'t find an answer to your question.',
            timestamp: new Date(),
            citations: response.data.citations || []
          };
          return [...withoutLoading, assistantMessage];
        } else {
          const errorMessage: Message = {
            id: generateId(),
            type: 'assistant',
            content: 'Sorry, I encountered an error processing your question.',
            timestamp: new Date(),
            error: response.error || 'Unknown error'
          };
          return [...withoutLoading, errorMessage];
        }
      });
      
    } catch (error) {
      console.error('Query submission failed:', error);
      
      // Remove loading message and show error
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== loadingMessage.id);
        const errorMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: 'Sorry, I couldn\'t process your question right now.',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Network error'
        };
        return [...withoutLoading, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle citation click
  const handleCitationClick = (citation: Citation) => {
    // Send message to open document
    sendMessage({
      type: 'open_document',
      data: {
        documentId: citation.documentId,
        page: citation.page,
        section: citation.section
      }
    }).catch(error => {
      console.error('Failed to open document:', error);
    });
  };

  // Speech synthesis for accessibility
  const speakText = useCallback((text: string) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    // Use a more natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && voice.name.includes('Natural')
    ) || voices.find(voice => voice.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [speechEnabled]);

  // Stop speech synthesis
  const stopSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    // Alt + S for accessibility settings
    if (event.altKey && event.key === 's') {
      event.preventDefault();
      setShowAccessibilitySettings(true);
      announceToScreenReader('Accessibility settings opened');
    }

    // Alt + R to read last message
    if (event.altKey && event.key === 'r' && messages.length > 0) {
      event.preventDefault();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'assistant') {
        speakText(lastMessage.content);
        announceToScreenReader('Reading last response');
      }
    }

    // Alt + X to stop speech
    if (event.altKey && event.key === 'x') {
      event.preventDefault();
      stopSpeech();
      announceToScreenReader('Speech stopped');
    }

    // Ctrl/Cmd + / for help
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showKeyboardShortcuts();
    }
  }, [messages, speakText, stopSpeech, announceToScreenReader]);

  // Show keyboard shortcuts help
  const showKeyboardShortcuts = () => {
    const shortcuts = [
      'Alt + S: Open accessibility settings',
      'Alt + R: Read last AI response',
      'Alt + X: Stop speech',
      'Ctrl + K: Focus input field',
      'Escape: Close dialogs or clear input',
      'Tab: Navigate between elements',
      'Enter: Submit question',
      'Ctrl + /: Show this help'
    ];

    const helpText = 'Keyboard shortcuts: ' + shortcuts.join(', ');
    announceToScreenReader(helpText);
    
    if (speechEnabled && a11ySettings.screenReaderMode) {
      speakText(helpText);
    }
  };

  // Set up keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts]);

  // Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > 0 && a11ySettings.announceChanges) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'assistant' && !lastMessage.isLoading) {
        setTimeout(() => {
          announceToScreenReader('AI response received');
          
          // Optionally speak the response
          if (speechEnabled && a11ySettings.screenReaderMode && lastMessage.content) {
            speakText(lastMessage.content);
          }
        }, 500);
      }
    }
  }, [messages, a11ySettings.announceChanges, a11ySettings.screenReaderMode, speechEnabled, announceToScreenReader, speakText]);

  // Utility functions
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Apply theme and accessibility settings
  useEffect(() => {
    if (settings) {
      document.documentElement.setAttribute(
        'data-theme',
        settings.highContrast ? 'high-contrast' : 'default'
      );
      document.documentElement.setAttribute(
        'data-reduce-motion',
        settings.reduceMotion ? 'true' : 'false'
      );
    }
  }, [settings]);

  // Render authentication required state
  if (!isAuthenticated) {
    return (
      <div 
        className="sidepanel-container" 
        ref={containerRef}
        role="main"
        aria-label="School Co-Pilot Authentication"
      >
        <div className="background-animation" aria-hidden="true" />
        <div className="sidepanel-header">
          <h1 className="header-title" id="app-title">
            <div className="header-icon" aria-hidden="true">SC</div>
            School Co-Pilot
          </h1>
        </div>
        <div className="chat-container">
          <EmptyState
            title="Authentication Required"
            description="Please log in to your school account to use School Co-Pilot."
            icon="🔐"
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="sidepanel-container" 
      ref={containerRef}
      role="main"
      aria-labelledby="app-title"
    >
      <div className="background-animation" aria-hidden="true" />
      
      {/* Header */}
      <header className="sidepanel-header" role="banner">
        <h1 className="header-title" id="app-title">
          <div className="header-icon" aria-hidden="true">SC</div>
          School Co-Pilot
        </h1>
        
        <div className="header-controls">
          <ClassSelector
            classes={classes}
            selectedClass={selectedClass}
            onClassChange={handleClassChange}
            disabled={isLoading}
          />
          
          {/* Accessibility Controls */}
          <div className="accessibility-controls">
            {speechEnabled && (
              <button
                onClick={stopSpeech}
                className="accessibility-button"
                aria-label="Stop speech synthesis"
                title="Stop speech (Alt+X)"
              >
                {a11ySettings.screenReaderMode ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            
            <button
              onClick={() => setShowAccessibilitySettings(true)}
              className="accessibility-button"
              aria-label="Open accessibility settings"
              title="Accessibility settings (Alt+S)"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="chat-container" id="main-content" tabIndex={-1}>
        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={() => {
              setError(null);
              announceToScreenReader('Error message dismissed');
            }} 
          />
        )}
        
        {messages.length === 0 && !error ? (
          <EmptyState
            title="Welcome to School Co-Pilot!"
            description="Ask questions about your course materials, get explanations, or request summaries. I'll only use information from your class documents."
            icon="🎓"
          />
        ) : (
          <div 
            className="messages-area" 
            role="log" 
            aria-live="polite" 
            aria-label="Chat conversation"
            aria-describedby="chat-description"
          >
            <div id="chat-description" className="sr-only">
              Conversation between you and the AI assistant. New messages will be announced automatically.
            </div>
            
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCitationClick={handleCitationClick}
                isLatest={index === messages.length - 1}
              />
            ))}
            {isLoading && <LoadingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="input-area" role="contentinfo">
        <QuickActions
          onActionClick={handleQuickAction}
          disabled={isLoading || !selectedClass}
        />
        
        <InputField
          ref={inputRef}
          value={currentInput}
          onChange={setCurrentInput}
          onSubmit={handleSubmit}
          disabled={isLoading || !selectedClass}
          placeholder={
            !selectedClass 
              ? "Please select a class to start asking questions..."
              : "Ask a question about your course materials..."
          }
          aria-describedby="input-help"
        />
        
        <div id="input-help" className="sr-only">
          Type your question and press Enter to submit. Use Alt+R to hear the last response, Alt+S for accessibility settings.
        </div>
      </footer>

      {/* Accessibility Settings Modal */}
      <AccessibilitySettings
        isOpen={showAccessibilitySettings}
        onClose={() => {
          setShowAccessibilitySettings(false);
          announceToScreenReader('Accessibility settings closed');
        }}
      />

      {/* Live Region for Announcements */}
      <div
        id="accessibility-announcements"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Status Region for Important Updates */}
      <div
        id="status-announcements"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </div>
  );
};