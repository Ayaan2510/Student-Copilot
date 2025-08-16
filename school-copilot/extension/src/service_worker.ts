/**
 * Production Service Worker for School Co-Pilot Chrome Extension
 * Handles background processing, API communication, and extension lifecycle
 */

import { ExtensionMessage, QueryRequest, QueryResponse, ExtensionSettings, PermissionStatus } from '@shared/types';
import { getApiClient, initializeApiClient, ApiError } from './services/api-client';
import { StorageService } from './services/storage-service';

// Global state
let isInitialized = false;
let currentSettings: ExtensionSettings | null = null;
let apiClient: any = null;
let isOnline = true;
let retryQueue: Array<{ message: ExtensionMessage; resolve: Function; reject: Function }> = [];

/**
 * Initialize service worker with full production features
 */
async function initialize(): Promise<void> {
  if (isInitialized) return;
  
  try {
    console.log('🚀 School Co-Pilot Service Worker initializing...');
    
    // Initialize storage service
    await StorageService.initialize();
    
    // Initialize API client
    apiClient = await initializeApiClient();
    
    // Load settings
    currentSettings = await StorageService.getSettings();
    
    // Set up all listeners
    setupMessageListeners();
    setupCommandListeners();
    setupStorageListeners();
    setupNetworkListeners();
    
    // Set up context menu
    await setupContextMenu();
    
    // Verify API connection
    await verifyApiConnection();
    
    // Set up periodic tasks
    setupPeriodicTasks();
    
    // Process any queued messages
    await processRetryQueue();
    
    isInitialized = true;
    console.log('✅ School Co-Pilot Service Worker initialized successfully');
    
  } catch (error) {
    console.error('❌ Service Worker initialization failed:', error);
  }
}

/**
 * Set up comprehensive message listeners
 */
function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => {
        console.error('Message handling error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          code: error.code || 'UNKNOWN_ERROR'
        });
      });
    
    return true; // Keep message channel open for async response
  });

  // Handle external messages (from web pages)
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    // Only allow messages from school domains
    if (sender.origin && sender.origin.endsWith('.edu')) {
      handleExternalMessage(message, sender)
        .then(response => sendResponse({ success: true, data: response }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Unauthorized origin' });
    }
    
    return true;
  });
}

/**
 * Handle incoming messages with comprehensive routing
 */
async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  console.log('📨 Received message:', message.type, message.data);
  
  // Queue message if offline
  if (!isOnline && message.type === 'query') {
    return new Promise((resolve, reject) => {
      retryQueue.push({ message, resolve, reject });
    });
  }
  
  switch (message.type) {
    case 'query':
      return await handleQuery(message.data);
    
    case 'settings_update':
      return await handleSettingsUpdate(message.data);
    
    case 'permission_check':
      return await checkPermissions(message.data.studentId, message.data.classId);
    
    case 'text_selection':
      return await handleTextSelection(message.data);
    
    case 'api_request':
      return await handleApiRequest(message.data);
    
    case 'get_classes':
      return await getClasses();
    
    case 'get_user_info':
      return await getCurrentUser();
    
    case 'login':
      return await handleLogin(message.data);
    
    case 'logout':
      return await handleLogout();
    
    case 'open_copilot':
      return await openSidePanel();
    
    case 'cache_clear':
      return await clearCache();
    
    case 'export_data':
      return await exportUserData();
    
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Handle query requests with full production features
 */
async function handleQuery(queryData: any): Promise<QueryResponse> {
  try {
    if (!apiClient || !currentSettings?.sessionToken) {
      throw new ApiError('Not authenticated. Please log in first.', 401, 'UNAUTHORIZED');
    }
    
    if (!currentSettings?.selectedClassId) {
      throw new ApiError('No class selected. Please select a class first.', 400, 'NO_CLASS_SELECTED');
    }

    // Check cached response first
    const cachedResponse = await StorageService.getCachedQueryResponse(
      queryData.query, 
      currentSettings.selectedClassId
    );
    
    if (cachedResponse) {
      console.log('📋 Returning cached response');
      return { ...cachedResponse, fromCache: true };
    }

    // Create query request
    const queryRequest: QueryRequest = {
      studentId: queryData.studentId || await getCurrentUserId(),
      classId: currentSettings.selectedClassId,
      query: queryData.query,
      timestamp: new Date(),
      sessionId: generateSessionId()
    };

    // Submit query to API
    const response = await apiClient.submitQuery(queryRequest);

    // Cache successful response
    if (response.success) {
      await StorageService.cacheQueryResponse(
        queryData.query,
        currentSettings.selectedClassId,
        response
      );
    }

    // Log activity
    await StorageService.logActivity({
      type: 'query',
      studentId: queryRequest.studentId,
      classId: queryRequest.classId,
      details: `Query: ${queryRequest.query.substring(0, 100)}${queryRequest.query.length > 100 ? '...' : ''}`,
      timestamp: new Date()
    });

    return response;
    
  } catch (error) {
    console.error('Query error:', error);
    
    // Log failed query
    await StorageService.logActivity({
      type: 'query',
      studentId: queryData.studentId || 'unknown',
      classId: currentSettings?.selectedClassId || 'unknown',
      details: `Failed query: ${error.message}`,
      timestamp: new Date()
    });
    
    throw error;
  }
}

/**
 * Handle settings updates
 */
async function handleSettingsUpdate(settingsData: Partial<ExtensionSettings>): Promise<void> {
  try {
    await StorageService.saveSettings(settingsData);
    currentSettings = await StorageService.getSettings();
    
    // Update API client if needed
    if (settingsData.apiBaseUrl && apiClient) {
      apiClient.updateConfig({ baseUrl: settingsData.apiBaseUrl });
    }
    
    if (settingsData.sessionToken && apiClient) {
      apiClient.setAuthToken(settingsData.sessionToken);
    }
    
    console.log('⚙️ Settings updated successfully');
  } catch (error) {
    console.error('Settings update error:', error);
    throw error;
  }
}

/**
 * Handle login requests
 */
async function handleLogin(loginData: any): Promise<AuthResponse> {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }

    const response = await apiClient.login(loginData);
    
    // Update settings with new token
    await StorageService.saveSettings({
      sessionToken: response.token
    });
    
    currentSettings = await StorageService.getSettings();
    
    // Log successful login
    await StorageService.logActivity({
      type: 'login',
      studentId: response.user.id,
      details: `Successful login: ${response.user.email}`,
      timestamp: new Date()
    });
    
    return response;
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Log failed login
    await StorageService.logActivity({
      type: 'login',
      studentId: 'unknown',
      details: `Failed login attempt: ${error.message}`,
      timestamp: new Date()
    });
    
    throw error;
  }
}

/**
 * Handle logout requests
 */
async function handleLogout(): Promise<void> {
  try {
    if (apiClient) {
      await apiClient.logout();
    }
    
    // Clear settings
    await StorageService.saveSettings({
      sessionToken: null,
      selectedClassId: null
    });
    
    currentSettings = await StorageService.getSettings();
    
    // Clear sensitive cached data
    await StorageService.clearCache();
    
    console.log('👋 User logged out successfully');
    
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

/**
 * Check user permissions with caching
 */
async function checkPermissions(studentId: string, classId: string): Promise<PermissionStatus> {
  try {
    if (!apiClient || !currentSettings?.sessionToken) {
      return {
        hasAccess: false,
        reason: 'Not authenticated',
        classEnabled: false,
        studentEnabled: false
      };
    }

    // Check cache first
    const cacheKey = `permissions_${studentId}_${classId}`;
    const cachedPermissions = await StorageService.getCachedData<PermissionStatus>(cacheKey);
    
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // Get fresh permissions from API
    const permissions = await apiClient.checkPermissions(classId);
    
    // Cache permissions for 5 minutes
    await StorageService.cacheData(cacheKey, permissions, 5 * 60 * 1000);
    
    return permissions;
    
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasAccess: false,
      reason: error.message,
      classEnabled: false,
      studentEnabled: false
    };
  }
}

/**
 * Get available classes for user
 */
async function getClasses(): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }

    // Check cache first
    const cachedClasses = await StorageService.getCachedData<Array<{ id: string; name: string; enabled: boolean }>>('user_classes');
    
    if (cachedClasses) {
      return cachedClasses;
    }

    // Get fresh data from API
    const classes = await apiClient.getClasses();
    
    // Cache for 10 minutes
    await StorageService.cacheData('user_classes', classes, 10 * 60 * 1000);
    
    return classes;
    
  } catch (error) {
    console.error('Error getting classes:', error);
    throw error;
  }
}

/**
 * Get current user information
 */
async function getCurrentUser(): Promise<any> {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }

    // Check cache first
    const cachedUser = await StorageService.getCachedData('current_user');
    
    if (cachedUser) {
      return cachedUser;
    }

    // Get fresh data from API
    const user = await apiClient.getCurrentUser();
    
    // Cache for 30 minutes
    await StorageService.cacheData('current_user', user, 30 * 60 * 1000);
    
    return user;
    
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
}

/**
 * Get current user ID
 */
async function getCurrentUserId(): Promise<string> {
  try {
    const user = await getCurrentUser();
    return user.id;
  } catch (error) {
    return 'anonymous';
  }
}

/**
 * Handle generic API requests
 */
async function handleApiRequest(requestData: any): Promise<any> {
  try {
    if (!apiClient) {
      throw new Error('API client not initialized');
    }

    const { endpoint, method = 'GET', body, headers } = requestData;
    
    const options: RequestInit = {
      method,
      headers: headers || {}
    };

    if (body) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return await apiClient.makeRequest(endpoint, options);
    
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * Set up storage change listeners
 */
function setupStorageListeners(): void {
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync' && changes.school_copilot_settings) {
      // Settings changed, reload them
      currentSettings = await StorageService.getSettings();
      
      // Update API client
      if (apiClient) {
        apiClient.updateConfig({ baseUrl: currentSettings.apiBaseUrl });
        apiClient.setAuthToken(currentSettings.sessionToken);
      }
      
      console.log('⚙️ Settings reloaded from storage change');
    }
  });
}

/**
 * Set up network status monitoring
 */
function setupNetworkListeners(): void {
  // Monitor online/offline status
  if (typeof navigator !== 'undefined') {
    const updateOnlineStatus = () => {
      const wasOnline = isOnline;
      isOnline = navigator.onLine;
      
      if (!wasOnline && isOnline) {
        console.log('🌐 Back online, processing retry queue');
        processRetryQueue();
      } else if (wasOnline && !isOnline) {
        console.log('📴 Gone offline, queuing requests');
      }
    };

    addEventListener('online', updateOnlineStatus);
    addEventListener('offline', updateOnlineStatus);
    
    // Initial status
    isOnline = navigator.onLine;
  }
}

/**
 * Set up periodic maintenance tasks
 */
function setupPeriodicTasks(): void {
  // Clean up expired cache every hour
  setInterval(async () => {
    try {
      await StorageService.cleanupExpiredCache();
      console.log('🧹 Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Refresh authentication token every 30 minutes
  setInterval(async () => {
    try {
      if (apiClient && currentSettings?.sessionToken) {
        await apiClient.refreshToken();
        console.log('🔄 Authentication token refreshed');
      }
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // Clear invalid token
      await StorageService.saveSettings({ sessionToken: null });
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Verify API connection every 5 minutes
  setInterval(async () => {
    const wasOnline = isOnline;
    isOnline = await verifyApiConnection();
    
    if (!wasOnline && isOnline) {
      await processRetryQueue();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Process queued messages when back online
 */
async function processRetryQueue(): Promise<void> {
  if (!isOnline || retryQueue.length === 0) return;
  
  console.log(`📤 Processing ${retryQueue.length} queued messages`);
  
  const queue = [...retryQueue];
  retryQueue = [];
  
  for (const { message, resolve, reject } of queue) {
    try {
      const result = await handleMessage(message, {} as chrome.runtime.MessageSender);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
}

/**
 * Verify API connection
 */
async function verifyApiConnection(): Promise<boolean> {
  try {
    if (!apiClient) return false;
    
    const isConnected = await apiClient.testConnection();
    
    if (isConnected) {
      console.log('✅ API connection verified');
    } else {
      console.warn('⚠️ API connection failed');
    }
    
    return isConnected;
  } catch (error) {
    console.warn('⚠️ API connection error:', error.message);
    return false;
  }
}

/**
 * Set up comprehensive keyboard commands
 */
function setupCommandListeners(): void {
  chrome.commands.onCommand.addListener(async (command) => {
    console.log('⌨️ Command received:', command);
    
    try {
      switch (command) {
        case 'open_copilot':
          await openSidePanel();
          break;
        
        case 'quick_define':
          await handleQuickAction('define');
          break;
        
        case 'quick_explain':
          await handleQuickAction('explain');
          break;
        
        default:
          console.warn('Unknown command:', command);
      }
    } catch (error) {
      console.error('Command error:', error);
      showNotification('Error', error.message, 'error');
    }
  });
}

/**
 * Set up comprehensive context menu
 */
async function setupContextMenu(): Promise<void> {
  try {
    // Remove existing context menus
    await chrome.contextMenus.removeAll();
    
    // Create main context menu
    chrome.contextMenus.create({
      id: 'school_copilot_main',
      title: 'School Co-Pilot',
      contexts: ['selection']
    });
    
    // Create sub-menus with icons
    chrome.contextMenus.create({
      id: 'define_selection',
      parentId: 'school_copilot_main',
      title: '📖 Define "%s"',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'explain_selection',
      parentId: 'school_copilot_main',
      title: '💡 Explain "%s"',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'summarize_selection',
      parentId: 'school_copilot_main',
      title: '📝 Summarize "%s"',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'ask_about_selection',
      parentId: 'school_copilot_main',
      title: '❓ Ask about "%s"',
      contexts: ['selection']
    });

    // Add separator
    chrome.contextMenus.create({
      id: 'separator1',
      parentId: 'school_copilot_main',
      type: 'separator',
      contexts: ['selection']
    });

    // Add utility options
    chrome.contextMenus.create({
      id: 'open_assistant',
      parentId: 'school_copilot_main',
      title: '🚀 Open Assistant',
      contexts: ['selection']
    });
    
    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!info.selectionText || !tab?.id) return;
      
      try {
        let action = '';
        switch (info.menuItemId) {
          case 'define_selection':
            action = 'define';
            break;
          case 'explain_selection':
            action = 'explain';
            break;
          case 'summarize_selection':
            action = 'summarize';
            break;
          case 'ask_about_selection':
            action = 'ask';
            break;
          case 'open_assistant':
            await openSidePanel();
            return;
        }
        
        if (action) {
          const result = await handleTextSelection({
            text: info.selectionText,
            action
          });
          
          await openSidePanel();
          
          // Send result to side panel
          setTimeout(() => {
            broadcastMessage({
              type: 'quick_action_result',
              data: { action, result, text: info.selectionText }
            });
          }, 500);
        }
      } catch (error) {
        console.error('Context menu error:', error);
        showNotification('Error', error.message, 'error');
      }
    });
    
  } catch (error) {
    console.error('Error setting up context menu:', error);
  }
}

/**
 * Handle text selection with enhanced processing
 */
async function handleTextSelection(selectionData: any): Promise<QueryResponse> {
  try {
    const { text, action } = selectionData;
    
    if (!text || text.length < 3) {
      throw new Error('Selected text is too short (minimum 3 characters)');
    }

    if (text.length > 500) {
      throw new Error('Selected text is too long (maximum 500 characters)');
    }
    
    let query = '';
    switch (action) {
      case 'define':
        query = `What is the definition of "${text}"? Please provide a clear, educational explanation.`;
        break;
      case 'explain':
        query = `Please explain "${text}" in simple terms with examples if possible.`;
        break;
      case 'summarize':
        query = `Please summarize the key points about "${text}".`;
        break;
      case 'ask':
      default:
        query = `Can you help me understand: ${text}`;
    }
    
    return await handleQuery({ query });
    
  } catch (error) {
    console.error('Text selection error:', error);
    throw error;
  }
}

/**
 * Open side panel with error handling
 */
async function openSidePanel(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      
      // Log side panel opening
      await StorageService.logActivity({
        type: 'ui_interaction',
        studentId: await getCurrentUserId(),
        details: 'Opened side panel',
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
    throw new Error('Failed to open assistant panel');
  }
}

/**
 * Handle quick actions with comprehensive processing
 */
async function handleQuickAction(action: string): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    
    // Get selected text from content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'get_selection',
      data: { action }
    });
    
    if (response?.text) {
      const result = await handleTextSelection({
        text: response.text,
        action
      });
      
      // Show result in side panel
      await openSidePanel();
      
      // Send result to side panel with delay to ensure it's loaded
      setTimeout(() => {
        broadcastMessage({
          type: 'quick_action_result',
          data: { action, result, text: response.text }
        });
      }, 500);
      
      // Show success notification
      showNotification(
        'School Co-Pilot',
        `${action.charAt(0).toUpperCase() + action.slice(1)} completed successfully`,
        'success'
      );
    } else {
      showNotification(
        'School Co-Pilot',
        'Please select some text first',
        'info'
      );
    }
    
  } catch (error) {
    console.error('Quick action error:', error);
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Clear all cached data
 */
async function clearCache(): Promise<void> {
  try {
    await StorageService.clearCache();
    console.log('🗑️ Cache cleared successfully');
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

/**
 * Export user data for backup
 */
async function exportUserData(): Promise<any> {
  try {
    return await StorageService.exportData();
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Show notification to user
 */
function showNotification(title: string, message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  try {
    const iconUrl = type === 'error' ? 'assets/icon-error-32.png' : 'assets/icon-32.png';
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title,
      message,
      priority: type === 'error' ? 2 : 1
    });
  } catch (error) {
    console.error('Notification error:', error);
  }
}

/**
 * Broadcast message to all extension contexts
 */
function broadcastMessage(message: ExtensionMessage): void {
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    });
  });
  
  // Send to popup if open
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore if popup is not open
  });
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle external messages from web pages
 */
async function handleExternalMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
  // Only allow specific message types from external sources
  const allowedTypes = ['health_check', 'get_status'];
  
  if (!allowedTypes.includes(message.type)) {
    throw new Error('Message type not allowed from external source');
  }
  
  switch (message.type) {
    case 'health_check':
      return { status: 'healthy', extension: 'school-copilot' };
    
    case 'get_status':
      return {
        authenticated: !!(currentSettings?.sessionToken),
        selectedClass: currentSettings?.selectedClassId,
        online: isOnline
      };
    
    default:
      throw new Error('Unknown external message type');
  }
}

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🔧 Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    await StorageService.saveSettings({
      reduceMotion: false,
      highContrast: false,
      apiBaseUrl: 'http://localhost:8000'
    });
    
    // Show welcome notification
    showNotification(
      'School Co-Pilot Installed',
      'Welcome! Click the extension icon to get started.',
      'success'
    );
    
    // Open options page
    chrome.runtime.openOptionsPage();
  }
  
  await initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Extension starting up...');
  await initialize();
});

// Handle tab updates for content script injection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      // Ensure content script is injected
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_script.js']
      });
    } catch (error) {
      // Ignore injection errors (e.g., restricted pages)
    }
  }
});

// Handle extension suspension/wake
chrome.runtime.onSuspend.addListener(() => {
  console.log('😴 Service worker suspending...');
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('🔄 Service worker suspension canceled');
});

// Initialize service worker immediately
initialize().catch(error => {
  console.error('Failed to initialize service worker:', error);
});