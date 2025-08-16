/**
 * Message Handler for School Co-Pilot Chrome Extension
 * Centralized message routing and handling between extension components
 */

import { ExtensionMessage, QueryRequest, QueryResponse } from '@shared/types';
import { apiClient } from './api-client';
import { storageManager } from './storage';

export interface MessageHandler {
  type: string;
  handler: (message: ExtensionMessage, sender?: chrome.runtime.MessageSender) => Promise<any>;
}

export class MessageRouter {
  private handlers: Map<string, MessageHandler['handler']> = new Map();
  private static instance: MessageRouter;

  static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter();
    }
    return MessageRouter.instance;
  }

  /**
   * Register message handler
   */
  registerHandler(type: string, handler: MessageHandler['handler']): void {
    this.handlers.set(type, handler);
  }

  /**
   * Unregister message handler
   */
  unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    message: ExtensionMessage,
    sender?: chrome.runtime.MessageSender
  ): Promise<any> {
    try {
      const handler = this.handlers.get(message.type);
      
      if (!handler) {
        console.warn(`No handler registered for message type: ${message.type}`);
        return { success: false, error: `Unknown message type: ${message.type}` };
      }

      const result = await handler(message, sender);
      return result || { success: true };

    } catch (error) {
      console.error(`Error handling message ${message.type}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send message to extension context
   */
  async sendMessage(message: ExtensionMessage): Promise<any> {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send message to tab
   */
  async sendMessageToTab(tabId: number, message: ExtensionMessage): Promise<any> {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('Error sending message to tab:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all tabs
   */
  async broadcastToTabs(message: ExtensionMessage): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      
      const promises = tabs.map(async (tab) => {
        if (tab.id) {
          try {
            await this.sendMessageToTab(tab.id, message);
          } catch (error) {
            // Ignore errors for tabs that can't receive messages
          }
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error broadcasting to tabs:', error);
    }
  }
}

// Default message handlers
export class DefaultMessageHandlers {
  private router: MessageRouter;
  private isInitialized = false;

  constructor() {
    this.router = MessageRouter.getInstance();
  }

  /**
   * Initialize default handlers
   */
  init(): void {
    if (this.isInitialized) return;

    // Authentication handlers
    this.router.registerHandler('login', this.handleLogin.bind(this));
    this.router.registerHandler('logout', this.handleLogout.bind(this));
    this.router.registerHandler('check_auth', this.handleCheckAuth.bind(this));
    this.router.registerHandler('refresh_token', this.handleRefreshToken.bind(this));

    // Query handlers
    this.router.registerHandler('submit_query', this.handleSubmitQuery.bind(this));
    this.router.registerHandler('check_permissions', this.handleCheckPermissions.bind(this));

    // Settings handlers
    this.router.registerHandler('get_settings', this.handleGetSettings.bind(this));
    this.router.registerHandler('save_settings', this.handleSaveSettings.bind(this));
    this.router.registerHandler('settings_update', this.handleSettingsUpdate.bind(this));

    // Data handlers
    this.router.registerHandler('get_classes', this.handleGetClasses.bind(this));
    this.router.registerHandler('get_class_documents', this.handleGetClassDocuments.bind(this));
    this.router.registerHandler('upload_document', this.handleUploadDocument.bind(this));

    // System handlers
    this.router.registerHandler('health_check', this.handleHealthCheck.bind(this));
    this.router.registerHandler('get_system_status', this.handleGetSystemStatus.bind(this));
    this.router.registerHandler('test_connection', this.handleTestConnection.bind(this));

    // Activity handlers
    this.router.registerHandler('log_activity', this.handleLogActivity.bind(this));
    this.router.registerHandler('get_activity_log', this.handleGetActivityLog.bind(this));

    // Error handlers
    this.router.registerHandler('auth_failure', this.handleAuthFailure.bind(this));
    this.router.registerHandler('network_error', this.handleNetworkError.bind(this));

    this.isInitialized = true;
  }

  // Authentication handlers
  private async handleLogin(message: ExtensionMessage): Promise<any> {
    const { email, password, domain } = message.data;
    
    try {
      const response = await apiClient.login(email, password, domain);
      
      if (response.success && response.data?.token) {
        // Store token
        apiClient.setToken(response.data.token);
        await storageManager.saveSettings({ sessionToken: response.data.token });
        
        // Store session data
        await storageManager.saveSession({
          userId: response.data.user?.id,
          userRole: response.data.user?.role,
          selectedClassId: null,
          permissions: response.data.permissions
        });

        // Log activity
        await storageManager.logActivity({
          type: 'authentication',
          action: 'login',
          details: { email, domain },
          timestamp: new Date()
        });

        return { success: true, data: response.data };
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  private async handleLogout(message: ExtensionMessage): Promise<any> {
    try {
      // Clear token
      apiClient.setToken(null);
      
      // Clear stored data
      await Promise.all([
        storageManager.saveSettings({ sessionToken: null }),
        storageManager.clearSession(),
        storageManager.clearCached()
      ]);

      // Log activity
      await storageManager.logActivity({
        type: 'authentication',
        action: 'logout',
        details: {},
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  private async handleCheckAuth(message: ExtensionMessage): Promise<any> {
    try {
      const session = await storageManager.getSession();
      const settings = await storageManager.getSettings();
      
      if (!session || !settings.sessionToken) {
        return { success: false, authenticated: false };
      }

      // Set token and verify with API
      apiClient.setToken(settings.sessionToken);
      const userResponse = await apiClient.getCurrentUser();
      
      if (userResponse.success) {
        return {
          success: true,
          authenticated: true,
          user: userResponse.data,
          session
        };
      }
      
      // Token is invalid, clear it
      await this.handleLogout({ type: 'logout', data: {} });
      return { success: false, authenticated: false };
      
    } catch (error) {
      return {
        success: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Auth check failed'
      };
    }
  }

  private async handleRefreshToken(message: ExtensionMessage): Promise<any> {
    try {
      const response = await apiClient.refreshToken();
      
      if (response.success && response.data?.token) {
        await storageManager.saveSettings({ sessionToken: response.data.token });
        return { success: true, token: response.data.token };
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  // Query handlers
  private async handleSubmitQuery(message: ExtensionMessage): Promise<any> {
    try {
      const queryRequest: QueryRequest = message.data;
      
      // Log activity
      await storageManager.logActivity({
        type: 'query',
        action: 'submit',
        details: {
          question: queryRequest.question,
          classId: queryRequest.classId,
          studentId: queryRequest.studentId
        },
        timestamp: new Date()
      });

      const response = await apiClient.submitQuery(queryRequest);
      
      // Log response
      await storageManager.logActivity({
        type: 'query',
        action: 'response',
        details: {
          success: response.success,
          hasAnswer: !!response.data?.answer
        },
        timestamp: new Date()
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query submission failed'
      };
    }
  }

  private async handleCheckPermissions(message: ExtensionMessage): Promise<any> {
    try {
      const { classId } = message.data;
      return await apiClient.checkPermissions(classId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Permission check failed'
      };
    }
  }

  // Settings handlers
  private async handleGetSettings(message: ExtensionMessage): Promise<any> {
    try {
      const settings = await storageManager.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings'
      };
    }
  }

  private async handleSaveSettings(message: ExtensionMessage): Promise<any> {
    try {
      await storageManager.saveSettings(message.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings'
      };
    }
  }

  private async handleSettingsUpdate(message: ExtensionMessage): Promise<any> {
    // This is a broadcast message, no response needed
    return { success: true };
  }

  // Data handlers
  private async handleGetClasses(message: ExtensionMessage): Promise<any> {
    try {
      // Check cache first
      const cached = await storageManager.getCached('user_classes');
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }

      const response = await apiClient.getClasses();
      
      if (response.success && response.data) {
        // Cache for 5 minutes
        await storageManager.setCached('user_classes', response.data, 5 * 60 * 1000);
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get classes'
      };
    }
  }

  private async handleGetClassDocuments(message: ExtensionMessage): Promise<any> {
    try {
      const { classId } = message.data;
      const cacheKey = `class_documents_${classId}`;
      
      // Check cache first
      const cached = await storageManager.getCached(cacheKey);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }

      const response = await apiClient.getClassDocuments(classId);
      
      if (response.success && response.data) {
        // Cache for 2 minutes
        await storageManager.setCached(cacheKey, response.data, 2 * 60 * 1000);
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get class documents'
      };
    }
  }

  private async handleUploadDocument(message: ExtensionMessage): Promise<any> {
    try {
      const { file, classId } = message.data;
      
      // Log activity
      await storageManager.logActivity({
        type: 'document',
        action: 'upload',
        details: {
          fileName: file.name,
          fileSize: file.size,
          classId
        },
        timestamp: new Date()
      });

      const response = await apiClient.uploadDocument(file, classId);
      
      if (response.success) {
        // Clear related cache
        await storageManager.clearCached(`class_documents_${classId}`);
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document upload failed'
      };
    }
  }

  // System handlers
  private async handleHealthCheck(message: ExtensionMessage): Promise<any> {
    try {
      return await apiClient.healthCheck();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  private async handleGetSystemStatus(message: ExtensionMessage): Promise<any> {
    try {
      return await apiClient.getSystemStatus();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system status'
      };
    }
  }

  private async handleTestConnection(message: ExtensionMessage): Promise<any> {
    try {
      const { maxRetries = 3 } = message.data || {};
      return await apiClient.testConnection(maxRetries);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  // Activity handlers
  private async handleLogActivity(message: ExtensionMessage): Promise<any> {
    try {
      await storageManager.logActivity(message.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log activity'
      };
    }
  }

  private async handleGetActivityLog(message: ExtensionMessage): Promise<any> {
    try {
      const { limit = 100 } = message.data || {};
      const log = await storageManager.getActivityLog(limit);
      return { success: true, data: log };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity log'
      };
    }
  }

  // Error handlers
  private async handleAuthFailure(message: ExtensionMessage): Promise<any> {
    try {
      // Clear authentication data
      await this.handleLogout({ type: 'logout', data: {} });
      
      // Notify user
      await this.router.broadcastToTabs({
        type: 'auth_required',
        data: { message: message.data.message || 'Authentication required' }
      });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to handle auth failure'
      };
    }
  }

  private async handleNetworkError(message: ExtensionMessage): Promise<any> {
    try {
      // Add to offline queue if applicable
      if (message.data.request) {
        await storageManager.addToOfflineQueue(message.data.request);
      }
      
      // Notify user
      await this.router.broadcastToTabs({
        type: 'network_status',
        data: { online: false, message: message.data.message }
      });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to handle network error'
      };
    }
  }
}

// Export singleton instances
export const messageRouter = MessageRouter.getInstance();
export const defaultHandlers = new DefaultMessageHandlers();