/**
 * Content Script for School Co-Pilot Extension
 * Handles text selection and page interaction
 */

// Track if content script is already injected
if (!(window as any).schoolCopilotContentScript) {
  (window as any).schoolCopilotContentScript = true;

  console.log('School Co-Pilot content script loaded');

  // Listen for messages from extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'get_selection':
        handleGetSelection(sendResponse);
        return true;

      case 'open_query_interface':
        handleOpenQueryInterface(message.data);
        sendResponse({ success: true });
        break;

      case 'toggle_interface':
        handleToggleInterface();
        sendResponse({ success: true });
        break;

      default:
        break;
    }
  });

  // Handle text selection
  function handleGetSelection(sendResponse: (response: any) => void) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    sendResponse({
      success: true,
      text: selectedText,
      hasSelection: selectedText.length > 0
    });
  }

  // Handle opening query interface with prefilled text
  function handleOpenQueryInterface(data: { prefilledQuestion?: string }) {
    // This would typically open the side panel
    // For now, we'll just send a message to open it
    chrome.runtime.sendMessage({
      type: 'open_copilot',
      data: data
    }).catch(() => {
      // Ignore if service worker is not available
    });
  }

  // Handle toggling the interface
  function handleToggleInterface() {
    chrome.runtime.sendMessage({
      type: 'open_copilot',
      data: {}
    }).catch(() => {
      // Ignore if service worker is not available
    });
  }

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    // Alt+Shift+C to open School Co-Pilot
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
      event.preventDefault();
      handleToggleInterface();
    }
  });

  // Handle text selection for context menu
  let lastSelection = '';
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    
    if (selectedText !== lastSelection) {
      lastSelection = selectedText;
      
      // Notify background script about selection change
      if (selectedText.length > 0) {
        chrome.runtime.sendMessage({
          type: 'text_selected',
          data: { text: selectedText }
        }).catch(() => {
          // Ignore if service worker is not available
        });
      }
    }
  });

  // Detect educational platforms
  const detectPlatform = () => {
    const hostname = window.location.hostname;
    const platforms = {
      'canvas.instructure.com': 'Canvas',
      'blackboard.com': 'Blackboard',
      'moodle.org': 'Moodle',
      'schoology.com': 'Schoology',
      'classroom.google.com': 'Google Classroom'
    };

    for (const [domain, platform] of Object.entries(platforms)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }

    // Check for common LMS indicators
    if (document.querySelector('[class*="canvas"]') || 
        document.querySelector('[id*="canvas"]')) {
      return 'Canvas';
    }

    if (document.querySelector('[class*="blackboard"]') || 
        document.querySelector('[id*="blackboard"]')) {
      return 'Blackboard';
    }

    return null;
  };

  // Notify about platform detection
  const platform = detectPlatform();
  if (platform) {
    chrome.runtime.sendMessage({
      type: 'platform_detected',
      data: { platform, url: window.location.href }
    }).catch(() => {
      // Ignore if service worker is not available
    });
  }

  // Add visual indicator for supported pages
  if (platform) {
    const indicator = document.createElement('div');
    indicator.id = 'school-copilot-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #0066cc, #28a745);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease;
    `;
    indicator.textContent = 'SC';
    indicator.title = 'Open School Co-Pilot';
    
    indicator.addEventListener('click', handleToggleInterface);
    indicator.addEventListener('mouseenter', () => {
      indicator.style.transform = 'scale(1.1)';
    });
    indicator.addEventListener('mouseleave', () => {
      indicator.style.transform = 'scale(1)';
    });

    document.body.appendChild(indicator);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0.3';
        indicator.style.transform = 'scale(0.8)';
      }
    }, 5000);
  }
}