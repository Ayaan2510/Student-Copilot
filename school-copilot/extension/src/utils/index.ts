/**
 * Utility exports for School Co-Pilot Chrome Extension
 * Re-exports commonly used utilities and services
 */

// Re-export services for backward compatibility
export { getApiClient, initializeApiClient, ApiError } from '../services/api-client';
export { StorageService } from '../services/storage-service';

// Re-export message handling
export { messageRouter, defaultHandlers } from './message-handler';

// Re-export storage utilities (aliased from StorageService)
export const storageManager = {
  getSettings: () => StorageService.getSettings(),
  saveSettings: (settings: any) => StorageService.saveSettings(settings),
  getSession: () => StorageService.getCachedData('session'),
  saveSession: (session: any) => StorageService.cacheData('session', session),
  clearSession: () => StorageService.clearCache(),
  getCached: (key: string) => StorageService.getCachedData(key),
  setCached: (key: string, data: any, ttl?: number) => StorageService.cacheData(key, data, ttl),
  clearCached: (key?: string) => StorageService.clearCache(),
  logActivity: (activity: any) => StorageService.logActivity(activity),
  getActivityLog: (limit?: number) => StorageService.getActivityLog(limit),
  clearActivityLog: () => StorageService.clearActivityLog(),
  addToOfflineQueue: (request: any) => StorageService.addToOfflineQueue(request),
  getOfflineQueue: () => StorageService.getOfflineQueue(),
  clearOfflineQueue: () => StorageService.clearOfflineQueue(),
  getStorageUsage: () => StorageService.getStorageUsage(),
  cleanup: () => StorageService.cleanupExpiredCache(),
  exportData: () => StorageService.exportData(),
  importData: (data: any) => StorageService.importData(data)
};

// Re-export API client utilities (aliased)
export const apiClient = {
  getInstance: () => getApiClient(),
  initialize: () => initializeApiClient()
};

// Common utility functions
export const utils = {
  /**
   * Generate unique ID
   */
  generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format date for display
   */
  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  },

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  },

  /**
   * Check if URL is valid
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Extract domain from URL
   */
  extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },

  /**
   * Sleep/delay function
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  },

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return !('update_url' in chrome.runtime.getManifest());
  },

  /**
   * Get extension version
   */
  getVersion(): string {
    return chrome.runtime.getManifest().version;
  },

  /**
   * Log with timestamp
   */
  log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }
};

// Export types for convenience
export type { ExtensionMessage, QueryRequest, QueryResponse, ExtensionSettings, PermissionStatus, ActivityLog } from '@shared/types';