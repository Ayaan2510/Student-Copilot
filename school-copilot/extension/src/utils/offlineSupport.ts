/**
 * Offline Support System
 * Handles offline detection, query caching, and graceful degradation
 */

import { QueryRequest, QueryResponse } from '@shared/types';
import { errorHandler, ErrorType } from './errorHandling';

export interface CachedQuery {
  id: string;
  request: QueryRequest;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'retrying' | 'failed' | 'completed';
}

export interface OfflineState {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  connectionType: string | null;
  effectiveType: string | null;
}

export interface CacheEntry<T = any> {
  id: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  size: number;
  accessCount: number;
  lastAccessed: Date;
}

// Offline Support Manager
export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = navigator.onLine;
  private connectionListeners: Set<(state: OfflineState) => void> = new Set();
  private queryQueue: Map<string, CachedQuery> = new Map();
  private responseCache: Map<string, CacheEntry<QueryResponse>> = new Map();
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private maxQueueSize = 100;
  private syncInProgress = false;

  private constructor() {
    this.setupConnectionMonitoring();
    this.loadPersistedData();
    this.startPeriodicSync();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  // Set up connection monitoring
  private setupConnectionMonitoring(): void {
    // Basic online/offline events
    window.addEventListener('online', () => {
      this.handleConnectionChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleConnectionChange(false);
    });

    // Network Information API (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      connection.addEventListener('change', () => {
        this.notifyConnectionListeners();
      });
    }

    // Periodic connectivity check
    setInterval(() => {
      this.checkConnectivity();
    }, 30000); // Check every 30 seconds
  }

  // Handle connection state changes
  private handleConnectionChange(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && !wasOnline) {
      // Just came back online
      console.log('Connection restored, syncing queued queries...');
      this.syncQueuedQueries();
    } else if (!isOnline && wasOnline) {
      // Just went offline
      console.log('Connection lost, entering offline mode...');
    }

    this.notifyConnectionListeners();
    this.persistState();
  }

  // Check connectivity with a lightweight request
  private async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      
      const isOnline = response.ok;
      
      if (isOnline !== this.isOnline) {
        this.handleConnectionChange(isOnline);
      }
      
      return isOnline;
    } catch (error) {
      if (this.isOnline) {
        this.handleConnectionChange(false);
      }
      return false;
    }
  }

  // Get current connection state
  getConnectionState(): OfflineState {
    const connection = (navigator as any).connection;
    
    return {
      isOnline: this.isOnline,
      lastOnlineTime: this.isOnline ? new Date() : null,
      connectionType: connection?.type || null,
      effectiveType: connection?.effectiveType || null
    };
  }

  // Subscribe to connection state changes
  onConnectionChange(callback: (state: OfflineState) => void): () => void {
    this.connectionListeners.add(callback);
    
    // Call immediately with current state
    callback(this.getConnectionState());
    
    // Return unsubscribe function
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  // Notify all connection listeners
  private notifyConnectionListeners(): void {
    const state = this.getConnectionState();
    this.connectionListeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  // Queue query for later execution
  queueQuery(request: QueryRequest, priority: 'high' | 'medium' | 'low' = 'medium'): string {
    const queryId = this.generateQueryId();
    
    const cachedQuery: CachedQuery = {
      id: queryId,
      request,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
      priority,
      status: 'pending'
    };

    this.queryQueue.set(queryId, cachedQuery);
    
    // Maintain queue size
    this.trimQueue();
    
    // Persist to storage
    this.persistQueue();
    
    console.log(`Query queued for offline execution: ${queryId}`);
    
    return queryId;
  }

  // Get queued queries
  getQueuedQueries(): CachedQuery[] {
    return Array.from(this.queryQueue.values())
      .sort((a, b) => {
        // Sort by priority, then by timestamp
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
  }

  // Remove query from queue
  removeFromQueue(queryId: string): boolean {
    const removed = this.queryQueue.delete(queryId);
    if (removed) {
      this.persistQueue();
    }
    return removed;
  }

  // Sync queued queries when online
  async syncQueuedQueries(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    const queries = this.getQueuedQueries();
    
    console.log(`Syncing ${queries.length} queued queries...`);

    for (const query of queries) {
      if (query.status === 'completed') {
        continue;
      }

      try {
        query.status = 'retrying';
        this.queryQueue.set(query.id, query);

        // Attempt to execute the query
        const response = await this.executeQuery(query.request);
        
        // Cache the response
        this.cacheResponse(query.request, response);
        
        // Mark as completed and remove from queue
        this.removeFromQueue(query.id);
        
        console.log(`Successfully synced query: ${query.id}`);
        
      } catch (error) {
        query.retryCount++;
        
        if (query.retryCount >= query.maxRetries) {
          query.status = 'failed';
          console.error(`Query failed after ${query.maxRetries} retries: ${query.id}`, error);
          
          // Report the error
          errorHandler.handleError(error, {
            action: 'sync_query_failed',
            additionalData: { queryId: query.id, retryCount: query.retryCount }
          });
        } else {
          query.status = 'pending';
          console.warn(`Query retry ${query.retryCount}/${query.maxRetries} failed: ${query.id}`, error);
        }
        
        this.queryQueue.set(query.id, query);
      }
    }

    this.syncInProgress = false;
    this.persistQueue();
    
    console.log('Query sync completed');
  }

  // Execute a query (placeholder - would integrate with actual API)
  private async executeQuery(request: QueryRequest): Promise<QueryResponse> {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Cache response for future use
  cacheResponse(request: QueryRequest, response: QueryResponse): void {
    const cacheKey = this.generateCacheKey(request);
    const now = new Date();
    
    const entry: CacheEntry<QueryResponse> = {
      id: cacheKey,
      data: response,
      timestamp: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      size: this.estimateSize(response),
      accessCount: 0,
      lastAccessed: now
    };

    this.responseCache.set(cacheKey, entry);
    
    // Maintain cache size
    this.trimCache();
    
    // Persist to storage
    this.persistCache();
  }

  // Get cached response
  getCachedResponse(request: QueryRequest): QueryResponse | null {
    const cacheKey = this.generateCacheKey(request);
    const entry = this.responseCache.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.responseCache.delete(cacheKey);
      this.persistCache();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.responseCache.set(cacheKey, entry);

    return entry.data;
  }

  // Clear expired cache entries
  clearExpiredCache(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [key, entry] of this.responseCache.entries()) {
      if (entry.expiresAt < now) {
        this.responseCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleared ${removedCount} expired cache entries`);
      this.persistCache();
    }
  }

  // Get cache statistics
  getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.responseCache.values());
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (totalAccesses / entries.length) : 0;
    
    const timestamps = entries.map(entry => entry.timestamp);
    const oldestEntry = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const newestEntry = new Date(Math.max(...timestamps.map(t => t.getTime())));

    return {
      totalEntries: entries.length,
      totalSize,
      hitRate,
      oldestEntry,
      newestEntry
    };
  }

  // Clear all cached data
  clearCache(): void {
    this.responseCache.clear();
    this.queryQueue.clear();
    this.clearPersistedData();
    console.log('All cached data cleared');
  }

  // Trim cache to maintain size limits
  private trimCache(): void {
    const stats = this.getCacheStats();
    
    if (stats.totalSize <= this.maxCacheSize) {
      return;
    }

    // Sort entries by access frequency and age (LRU + LFU hybrid)
    const entries = Array.from(this.responseCache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: entry.accessCount / Math.max(1, (Date.now() - entry.lastAccessed.getTime()) / 1000 / 60 / 60) // Access per hour
      }))
      .sort((a, b) => a.score - b.score); // Lowest score first (candidates for removal)

    let removedSize = 0;
    let removedCount = 0;

    for (const { key, entry } of entries) {
      this.responseCache.delete(key);
      removedSize += entry.size;
      removedCount++;

      if (stats.totalSize - removedSize <= this.maxCacheSize * 0.8) {
        break; // Leave some headroom
      }
    }

    if (removedCount > 0) {
      console.log(`Trimmed cache: removed ${removedCount} entries (${removedSize} bytes)`);
      this.persistCache();
    }
  }

  // Trim query queue to maintain size limits
  private trimQueue(): void {
    if (this.queryQueue.size <= this.maxQueueSize) {
      return;
    }

    const queries = Array.from(this.queryQueue.entries())
      .sort(([, a], [, b]) => {
        // Keep high priority and recent queries
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

    // Remove oldest, lowest priority queries
    const toRemove = queries.slice(this.maxQueueSize);
    
    for (const [queryId] of toRemove) {
      this.queryQueue.delete(queryId);
    }

    if (toRemove.length > 0) {
      console.log(`Trimmed query queue: removed ${toRemove.length} queries`);
    }
  }

  // Generate cache key for a request
  private generateCacheKey(request: QueryRequest): string {
    const key = `${request.classId}_${request.query}_${request.quickAction || ''}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  // Generate unique query ID
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Estimate object size in bytes
  private estimateSize(obj: any): number {
    return new Blob([JSON.stringify(obj)]).size;
  }

  // Persist state to storage
  private persistState(): void {
    try {
      const state = {
        isOnline: this.isOnline,
        lastUpdate: new Date().toISOString()
      };
      
      localStorage.setItem('schoolCopilot_offlineState', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist offline state:', error);
    }
  }

  // Persist query queue to storage
  private persistQueue(): void {
    try {
      const queries = Array.from(this.queryQueue.entries()).map(([id, query]) => [
        id,
        {
          ...query,
          timestamp: query.timestamp.toISOString()
        }
      ]);
      
      localStorage.setItem('schoolCopilot_queryQueue', JSON.stringify(queries));
    } catch (error) {
      console.warn('Failed to persist query queue:', error);
    }
  }

  // Persist response cache to storage
  private persistCache(): void {
    try {
      const cache = Array.from(this.responseCache.entries()).map(([id, entry]) => [
        id,
        {
          ...entry,
          timestamp: entry.timestamp.toISOString(),
          expiresAt: entry.expiresAt.toISOString(),
          lastAccessed: entry.lastAccessed.toISOString()
        }
      ]);
      
      localStorage.setItem('schoolCopilot_responseCache', JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to persist response cache:', error);
    }
  }

  // Load persisted data from storage
  private loadPersistedData(): void {
    try {
      // Load query queue
      const queueData = localStorage.getItem('schoolCopilot_queryQueue');
      if (queueData) {
        const queries = JSON.parse(queueData);
        for (const [id, query] of queries) {
          this.queryQueue.set(id, {
            ...query,
            timestamp: new Date(query.timestamp)
          });
        }
      }

      // Load response cache
      const cacheData = localStorage.getItem('schoolCopilot_responseCache');
      if (cacheData) {
        const cache = JSON.parse(cacheData);
        for (const [id, entry] of cache) {
          this.responseCache.set(id, {
            ...entry,
            timestamp: new Date(entry.timestamp),
            expiresAt: new Date(entry.expiresAt),
            lastAccessed: new Date(entry.lastAccessed)
          });
        }
      }

      // Clean up expired entries
      this.clearExpiredCache();
      
    } catch (error) {
      console.warn('Failed to load persisted data:', error);
    }
  }

  // Clear all persisted data
  private clearPersistedData(): void {
    localStorage.removeItem('schoolCopilot_offlineState');
    localStorage.removeItem('schoolCopilot_queryQueue');
    localStorage.removeItem('schoolCopilot_responseCache');
  }

  // Start periodic maintenance tasks
  private startPeriodicSync(): void {
    // Sync queued queries every 2 minutes when online
    setInterval(() => {
      if (this.isOnline && this.queryQueue.size > 0) {
        this.syncQueuedQueries();
      }
    }, 2 * 60 * 1000);

    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      this.clearExpiredCache();
    }, 10 * 60 * 1000);

    // Persist state every 5 minutes
    setInterval(() => {
      this.persistState();
    }, 5 * 60 * 1000);
  }
}

// Convenience functions and exports
export const offlineManager = OfflineManager.getInstance();

export const isOnline = () => offlineManager.getConnectionState().isOnline;

export const queueQuery = (request: QueryRequest, priority?: 'high' | 'medium' | 'low') => 
  offlineManager.queueQuery(request, priority);

export const getCachedResponse = (request: QueryRequest) => 
  offlineManager.getCachedResponse(request);

export const onConnectionChange = (callback: (state: OfflineState) => void) => 
  offlineManager.onConnectionChange(callback);

export const getQueuedQueries = () => offlineManager.getQueuedQueries();

export const getCacheStats = () => offlineManager.getCacheStats();

export const clearOfflineData = () => offlineManager.clearCache();