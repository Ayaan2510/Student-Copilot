/**
 * API Client for School Co-Pilot Chrome Extension
 * Handles all communication with the backend API
 */

import { 
  QueryRequest, 
  QueryResponse, 
  AuthResponse, 
  LoginRequest,
  PermissionStatus,
  ExtensionSettings 
} from '@shared/types';

export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class ApiClient {
  private config: ApiClientConfig;
  private authToken: string | null = null;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: 'http://localhost:8000',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Get authentication token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout)
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 401) {
            // Clear invalid token
            this.authToken = null;
            await this.clearStoredToken();
            throw new ApiError('Authentication expired. Please log in again.', 401, 'UNAUTHORIZED');
          }

          if (response.status === 403) {
            throw new ApiError('Access denied. Check your permissions.', 403, 'FORBIDDEN');
          }

          if (response.status === 429) {
            throw new ApiError('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMITED');
          }

          throw new ApiError(
            errorData.detail || `API Error: ${response.status}`,
            response.status,
            'API_ERROR'
          );
        }

        return await response.json();

      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication or permission errors
        if (error instanceof ApiError && 
            ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.code)) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.config.retryAttempts - 1) {
          break;
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }

    throw new ApiError(
      `Request failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`,
      0,
      'NETWORK_ERROR'
    );
  }

  /**
   * Authenticate user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      // Store token
      this.authToken = response.token;
      await this.storeToken(response.token);

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        await this.makeRequest('/api/auth/logout', {
          method: 'POST'
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.authToken = null;
      await this.clearStoredToken();
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    return await this.makeRequest('/api/auth/me');
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ token: string }> {
    const response = await this.makeRequest<{ token: string }>('/api/auth/refresh', {
      method: 'POST'
    });

    this.authToken = response.token;
    await this.storeToken(response.token);

    return response;
  }

  /**
   * Submit query to RAG system
   */
  async submitQuery(queryRequest: QueryRequest): Promise<QueryResponse> {
    return await this.makeRequest<QueryResponse>('/api/query/', {
      method: 'POST',
      body: JSON.stringify(queryRequest)
    });
  }

  /**
   * Check user permissions for a class
   */
  async checkPermissions(classId: string): Promise<PermissionStatus> {
    return await this.makeRequest<PermissionStatus>(
      `/api/query/permission-check?class_id=${encodeURIComponent(classId)}`
    );
  }

  /**
   * Get available classes for user
   */
  async getClasses(): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
    return await this.makeRequest('/api/classes/');
  }

  /**
   * Get class details
   */
  async getClass(classId: string): Promise<any> {
    return await this.makeRequest(`/api/classes/${encodeURIComponent(classId)}`);
  }

  /**
   * Get documents for a class
   */
  async getClassDocuments(classId: string): Promise<any[]> {
    return await this.makeRequest(`/api/isolation/classes/${encodeURIComponent(classId)}/documents`);
  }

  /**
   * Get audit logs (for teachers)
   */
  async getAuditLogs(filters: any = {}): Promise<any[]> {
    const params = new URLSearchParams(filters);
    return await this.makeRequest(`/api/logs/?${params.toString()}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    return await this.makeRequest('/health');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      console.warn('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Store authentication token
   */
  private async storeToken(token: string): Promise<void> {
    try {
      await chrome.storage.sync.set({
        'school_copilot_auth_token': token,
        'school_copilot_auth_timestamp': Date.now()
      });
    } catch (error) {
      console.error('Error storing auth token:', error);
    }
  }

  /**
   * Clear stored authentication token
   */
  private async clearStoredToken(): Promise<void> {
    try {
      await chrome.storage.sync.remove([
        'school_copilot_auth_token',
        'school_copilot_auth_timestamp'
      ]);
    } catch (error) {
      console.error('Error clearing auth token:', error);
    }
  }

  /**
   * Load stored authentication token
   */
  async loadStoredToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.sync.get([
        'school_copilot_auth_token',
        'school_copilot_auth_timestamp'
      ]);

      const token = result.school_copilot_auth_token;
      const timestamp = result.school_copilot_auth_timestamp;

      if (!token || !timestamp) {
        return null;
      }

      // Check if token is expired (24 hours)
      const tokenAge = Date.now() - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (tokenAge > maxAge) {
        await this.clearStoredToken();
        return null;
      }

      this.authToken = token;
      return token;
    } catch (error) {
      console.error('Error loading stored token:', error);
      return null;
    }
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

/**
 * Get singleton API client instance
 */
export function getApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(config);
  } else if (config) {
    apiClientInstance.updateConfig(config);
  }
  
  return apiClientInstance;
}

/**
 * Initialize API client with stored settings
 */
export async function initializeApiClient(): Promise<ApiClient> {
  try {
    // Load settings from storage
    const result = await chrome.storage.sync.get('school_copilot_settings');
    const settings: ExtensionSettings = result.school_copilot_settings || {};

    // Create API client with settings
    const client = getApiClient({
      baseUrl: settings.apiBaseUrl || 'http://localhost:8000'
    });

    // Load stored authentication token
    await client.loadStoredToken();

    return client;
  } catch (error) {
    console.error('Error initializing API client:', error);
    return getApiClient();
  }
}