/**
 * Storage Service for School Co-Pilot Chrome Extension
 * Handles local storage, caching, and data persistence
 */

import { ExtensionSettings, ActivityLog, QueryResponse } from '@shared/types';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
}

export class StorageService {
  private static readonly STORAGE_KEYS = {
    SETTINGS: 'school_copilot_settings',
    SESSION: 'school_copilot_session',
    CACHE: 'school_copilot_cache',
    ACTIVITY_LOG: 'school_copilot_activity_log',
    QUERY_CACHE: 'school_copilot_query_cache',
    USER_PREFERENCES: 'school_copilot_user_preferences'
  };

  private static readonly CACHE_DURATION = {
    SHORT: 5 * 60 * 1000,      // 5 minutes
    MEDIUM: 30 * 60 * 1000,    // 30 minutes
    LONG: 2 * 60 * 60 * 1000,  // 2 hours
    DAY: 24 * 60 * 60 * 1000   // 24 hours
  };

  private static readonly MAX_ACTIVITY_LOG_SIZE = 1000;
  private static readonly MAX_QUERY_CACHE_SIZE = 100;

  /**
   * Get extension settings
   */
  static async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.SETTINGS);
      const settings = result[this.STORAGE_KEYS.SETTINGS] || {};

      return {
        reduceMotion: settings.reduceMotion || false,
        highContrast: settings.highContrast || false,
        selectedClassId: settings.selectedClassId || null,
        apiBaseUrl: settings.apiBaseUrl || 'http://localhost:8000',
        sessionToken: settings.sessionToken || null,
        ...settings
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        reduceMotion: false,
        highContrast: false,
        selectedClassId: null,
        apiBaseUrl: 'http://localhost:8000',
        sessionToken: null
      };
    }
  }

  /**
   * Save extension settings
   */
  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };

      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.SETTINGS]: updatedSettings
      });

      // Broadcast settings update
      this.broadcastSettingsUpdate(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Get session data
   */
  static async getSession(): Promise<any> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.SESSION);
      return result[this.STORAGE_KEYS.SESSION] || {};
    } catch (error) {
      console.error('Error getting session:', error);
      return {};
    }
  }

  /**
   * Save session data
   */
  static async saveSession(sessionData: any): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.SESSION]: {
          ...sessionData,
          lastUpdated: Date.now()
        }
      });
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Failed to save session');
    }
  }

  /**
   * Clear session data
   */
  static async clearSession(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEYS.SESSION);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Cache data with expiration
   */
  static async cacheData<T>(
    key: string, 
    data: T, 
    duration: number = this.CACHE_DURATION.MEDIUM
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + duration
      };

      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CACHE);
      const cache = result[this.STORAGE_KEYS.CACHE] || {};
      
      cache[key] = cacheEntry;

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CACHE]: cache
      });
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  /**
   * Get cached data
   */
  static async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CACHE);
      const cache = result[this.STORAGE_KEYS.CACHE] || {};
      const cacheEntry: CacheEntry<T> = cache[key];

      if (!cacheEntry) {
        return null;
      }

      // Check if cache entry is expired
      if (Date.now() > cacheEntry.expiresAt) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Remove cached data
   */
  static async removeCachedData(key: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CACHE);
      const cache = result[this.STORAGE_KEYS.CACHE] || {};
      
      delete cache[key];

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CACHE]: cache
      });
    } catch (error) {
      console.error('Error removing cached data:', error);
    }
  }

  /**
   * Clear all cached data
   */
  static async clearCache(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CACHE]: {}
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Log user activity
   */
  static async logActivity(activity: ActivityLog): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.ACTIVITY_LOG);
      const log: ActivityLog[] = result[this.STORAGE_KEYS.ACTIVITY_LOG] || [];

      // Add new activity
      log.push({
        ...activity,
        timestamp: new Date(),
        id: this.generateId()
      });

      // Trim log if it exceeds maximum size
      if (log.length > this.MAX_ACTIVITY_LOG_SIZE) {
        log.splice(0, log.length - this.MAX_ACTIVITY_LOG_SIZE);
      }

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.ACTIVITY_LOG]: log
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
   * Get activity log
   */
  static async getActivityLog(limit?: number): Promise<ActivityLog[]> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.ACTIVITY_LOG);
      const log: ActivityLog[] = result[this.STORAGE_KEYS.ACTIVITY_LOG] || [];

      if (limit) {
        return log.slice(-limit).reverse();
      }

      return log.reverse();
    } catch (error) {
      console.error('Error getting activity log:', error);
      return [];
    }
  }

  /**
   * Clear activity log
   */
  static async clearActivityLog(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.ACTIVITY_LOG]: []
      });
    } catch (error) {
      console.error('Error clearing activity log:', error);
    }
  }

  /**
   * Cache query response
   */
  static async cacheQueryResponse(
    query: string, 
    classId: string, 
    response: QueryResponse
  ): Promise<void> {
    try {
      const cacheKey = this.generateQueryCacheKey(query, classId);
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.QUERY_CACHE);
      const cache = result[this.STORAGE_KEYS.QUERY_CACHE] || {};

      cache[cacheKey] = {
        query,
        classId,
        response,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION.MEDIUM
      };

      // Trim cache if it exceeds maximum size
      const cacheKeys = Object.keys(cache);
      if (cacheKeys.length > this.MAX_QUERY_CACHE_SIZE) {
        // Remove oldest entries
        const sortedKeys = cacheKeys.sort((a, b) => 
          cache[a].timestamp - cache[b].timestamp
        );
        
        for (let i = 0; i < cacheKeys.length - this.MAX_QUERY_CACHE_SIZE; i++) {
          delete cache[sortedKeys[i]];
        }
      }

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.QUERY_CACHE]: cache
      });
    } catch (error) {
      console.error('Error caching query response:', error);
    }
  }

  /**
   * Get cached query response
   */
  static async getCachedQueryResponse(
    query: string, 
    classId: string
  ): Promise<QueryResponse | null> {
    try {
      const cacheKey = this.generateQueryCacheKey(query, classId);
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.QUERY_CACHE);
      const cache = result[this.STORAGE_KEYS.QUERY_CACHE] || {};
      const cacheEntry = cache[cacheKey];

      if (!cacheEntry) {
        return null;
      }

      // Check if cache entry is expired
      if (Date.now() > cacheEntry.expiresAt) {
        delete cache[cacheKey];
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.QUERY_CACHE]: cache
        });
        return null;
      }

      return cacheEntry.response;
    } catch (error) {
      console.error('Error getting cached query response:', error);
      return null;
    }
  }

  /**
   * Get storage quota information
   */
  static async getStorageQuota(): Promise<StorageQuota> {
    try {
      const quota = await chrome.storage.local.getBytesInUse();
      const maxQuota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default

      return {
        used: quota,
        available: maxQuota - quota,
        percentage: (quota / maxQuota) * 100
      };
    } catch (error) {
      console.error('Error getting storage quota:', error);
      return {
        used: 0,
        available: 5242880,
        percentage: 0
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean main cache
      const cacheResult = await chrome.storage.local.get(this.STORAGE_KEYS.CACHE);
      const cache = cacheResult[this.STORAGE_KEYS.CACHE] || {};
      
      Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
          delete cache[key];
        }
      });

      // Clean query cache
      const queryCacheResult = await chrome.storage.local.get(this.STORAGE_KEYS.QUERY_CACHE);
      const queryCache = queryCacheResult[this.STORAGE_KEYS.QUERY_CACHE] || {};
      
      Object.keys(queryCache).forEach(key => {
        if (queryCache[key].expiresAt < now) {
          delete queryCache[key];
        }
      });

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CACHE]: cache,
        [this.STORAGE_KEYS.QUERY_CACHE]: queryCache
      });
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
    }
  }

  /**
   * Export all data for backup
   */
  static async exportData(): Promise<any> {
    try {
      const syncData = await chrome.storage.sync.get();
      const localData = await chrome.storage.local.get();

      return {
        sync: syncData,
        local: localData,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Import data from backup
   */
  static async importData(data: any): Promise<void> {
    try {
      if (data.sync) {
        await chrome.storage.sync.set(data.sync);
      }
      
      if (data.local) {
        await chrome.storage.local.set(data.local);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw new Error('Failed to import data');
    }
  }

  /**
   * Clear all extension data
   */
  static async clearAllData(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate query cache key
   */
  private static generateQueryCacheKey(query: string, classId: string): string {
    const normalizedQuery = query.toLowerCase().trim();
    return `${classId}_${btoa(normalizedQuery).replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  /**
   * Broadcast settings update to all extension contexts
   */
  private static broadcastSettingsUpdate(settings: ExtensionSettings): void {
    try {
      // Send to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'settings_update',
              data: settings
            }).catch(() => {
              // Ignore errors for tabs without content script
            });
          }
        });
      });

      // Send to popup if open
      chrome.runtime.sendMessage({
        type: 'settings_update',
        data: settings
      }).catch(() => {
        // Ignore if popup is not open
      });
    } catch (error) {
      console.error('Error broadcasting settings update:', error);
    }
  }

  /**
   * Initialize storage service
   */
  static async initialize(): Promise<void> {
    try {
      // Clean up expired cache on startup
      await this.cleanupExpiredCache();

      // Set up periodic cleanup
      setInterval(() => {
        this.cleanupExpiredCache();
      }, 60 * 60 * 1000); // Every hour

      console.log('Storage service initialized');
    } catch (error) {
      console.error('Error initializing storage service:', error);
    }
  }
}