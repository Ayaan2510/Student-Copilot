/**
 * Keyboard Navigation Hook
 * Provides enhanced keyboard navigation functionality
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface KeyboardNavigationOptions {
  enableArrowKeys?: boolean;
  enableHomeEnd?: boolean;
  enableTypeAhead?: boolean;
  trapFocus?: boolean;
  autoFocus?: boolean;
  onEscape?: () => void;
  onEnter?: (element: HTMLElement) => void;
}

export const useKeyboardNavigation = (
  containerRef: React.RefObject<HTMLElement>,
  options: KeyboardNavigationOptions = {}
) => {
  const { settings, announceToScreenReader } = useAccessibility();
  const {
    enableArrowKeys = true,
    enableHomeEnd = true,
    enableTypeAhead = false,
    trapFocus = false,
    autoFocus = false,
    onEscape,
    onEnter
  } = options;

  const typeAheadRef = useRef('');
  const typeAheadTimeoutRef = useRef<NodeJS.Timeout>();
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]:not([aria-disabled="true"])',
      '[role="menuitem"]:not([aria-disabled="true"])',
      '[role="option"]:not([aria-disabled="true"])',
      '[role="tab"]:not([aria-disabled="true"])'
    ].join(', ');

    const elements = Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];

    return elements.filter(element => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, [containerRef]);

  // Update focusable elements list
  const updateFocusableElements = useCallback(() => {
    focusableElementsRef.current = getFocusableElements();
  }, [getFocusableElements]);

  // Get current focused element index
  const getCurrentFocusIndex = useCallback((): number => {
    const activeElement = document.activeElement as HTMLElement;
    return focusableElementsRef.current.indexOf(activeElement);
  }, []);

  // Focus element by index
  const focusElementByIndex = useCallback((index: number) => {
    const elements = focusableElementsRef.current;
    if (elements.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, elements.length - 1));
    const element = elements[clampedIndex];
    
    if (element) {
      element.focus();
      
      // Announce to screen reader if enabled
      if (settings.announceChanges) {
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('title') || 
                     element.textContent?.trim() || 
                     'Interactive element';
        announceToScreenReader(`Focused on ${label}`);
      }
    }
  }, [settings.announceChanges, announceToScreenReader]);

  // Handle arrow key navigation
  const handleArrowKeys = useCallback((event: KeyboardEvent) => {
    if (!enableArrowKeys) return;

    const currentIndex = getCurrentFocusIndex();
    if (currentIndex === -1) return;

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= focusableElementsRef.current.length) {
          newIndex = 0; // Wrap to beginning
        }
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = focusableElementsRef.current.length - 1; // Wrap to end
        }
        break;
    }

    if (newIndex !== currentIndex) {
      focusElementByIndex(newIndex);
    }
  }, [enableArrowKeys, getCurrentFocusIndex, focusElementByIndex]);

  // Handle Home/End keys
  const handleHomeEnd = useCallback((event: KeyboardEvent) => {
    if (!enableHomeEnd) return;

    switch (event.key) {
      case 'Home':
        event.preventDefault();
        focusElementByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusElementByIndex(focusableElementsRef.current.length - 1);
        break;
    }
  }, [enableHomeEnd, focusElementByIndex]);

  // Handle type-ahead search
  const handleTypeAhead = useCallback((event: KeyboardEvent) => {
    if (!enableTypeAhead) return;
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;

    // Clear previous timeout
    if (typeAheadTimeoutRef.current) {
      clearTimeout(typeAheadTimeoutRef.current);
    }

    // Add character to search string
    typeAheadRef.current += event.key.toLowerCase();

    // Find matching element
    const elements = focusableElementsRef.current;
    const currentIndex = getCurrentFocusIndex();
    
    // Search from current position forward, then wrap around
    const searchElements = [
      ...elements.slice(currentIndex + 1),
      ...elements.slice(0, currentIndex + 1)
    ];

    const matchingElement = searchElements.find(element => {
      const text = (element.textContent || element.getAttribute('aria-label') || '').toLowerCase();
      return text.startsWith(typeAheadRef.current);
    });

    if (matchingElement) {
      const matchIndex = elements.indexOf(matchingElement);
      focusElementByIndex(matchIndex);
    }

    // Clear search string after delay
    typeAheadTimeoutRef.current = setTimeout(() => {
      typeAheadRef.current = '';
    }, 1000);
  }, [enableTypeAhead, getCurrentFocusIndex, focusElementByIndex]);

  // Handle focus trapping
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (!trapFocus || event.key !== 'Tab') return;

    const elements = focusableElementsRef.current;
    if (elements.length === 0) return;

    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      // Shift + Tab (backward)
      if (activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab (forward)
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [trapFocus]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Update focusable elements on each interaction
    updateFocusableElements();

    // Handle escape key
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }

    // Handle enter key
    if (event.key === 'Enter' && onEnter) {
      const activeElement = document.activeElement as HTMLElement;
      if (focusableElementsRef.current.includes(activeElement)) {
        event.preventDefault();
        onEnter(activeElement);
        return;
      }
    }

    // Handle navigation keys
    handleArrowKeys(event);
    handleHomeEnd(event);
    handleTypeAhead(event);
    handleFocusTrap(event);
  }, [
    updateFocusableElements,
    onEscape,
    onEnter,
    handleArrowKeys,
    handleHomeEnd,
    handleTypeAhead,
    handleFocusTrap
  ]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !settings.keyboardNavigation) return;

    // Initial setup
    updateFocusableElements();

    // Auto-focus first element if requested
    if (autoFocus && focusableElementsRef.current.length > 0) {
      setTimeout(() => {
        focusElementByIndex(0);
      }, 100);
    }

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Observer for dynamic content changes
    const observer = new MutationObserver(() => {
      updateFocusableElements();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'aria-disabled']
    });

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, [
    containerRef,
    settings.keyboardNavigation,
    autoFocus,
    handleKeyDown,
    updateFocusableElements,
    focusElementByIndex
  ]);

  // Return utility functions
  return {
    focusFirst: () => focusElementByIndex(0),
    focusLast: () => focusElementByIndex(focusableElementsRef.current.length - 1),
    focusNext: () => {
      const currentIndex = getCurrentFocusIndex();
      focusElementByIndex(currentIndex + 1);
    },
    focusPrevious: () => {
      const currentIndex = getCurrentFocusIndex();
      focusElementByIndex(currentIndex - 1);
    },
    getFocusableElements: () => focusableElementsRef.current,
    updateFocusableElements
  };
};