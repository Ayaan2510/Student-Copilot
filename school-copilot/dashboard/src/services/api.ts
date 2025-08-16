/**
 * API Client for Teacher Dashboard
 * Handles all backend communication with proper error handling
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import type {
  LoginRequest,
  AuthResponse,
  TeacherUser,
  ClassInfo,
  Document,
  AuditLog,
  LogFilters,
  AccessRequest,
  StatusResponse,
  UploadResponse
} from '@shared/types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add timestamp to prevent caching
        config.params = {
          ...config.params,
          _t: Date.now(),
        };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleApiError(error: AxiosError) {
    if (error.response?.status === 401) {
      // Unauthorized - token expired or invalid
      this.setAuthToken(null);
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      return;
    }

    if (error.response?.status === 403) {
      toast.error('Access denied. You do not have permission for this action.');
      return;
    }

    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
      return;
    }

    if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.');
      return;
    }

    if (!error.response) {
      toast.error('Network error. Please check your connection.');
      return;
    }
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        data,
        ...config,
      });

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.detail || error.message,
          statusCode: error.response?.status,
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('POST', '/api/auth/login', credentials);
  }

  async logout(): Promise<ApiResponse> {
    return this.request('POST', '/api/auth/logout');
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.request<{ token: string }>('POST', '/api/auth/refresh');
  }

  async getCurrentUser(): Promise<ApiResponse<TeacherUser>> {
    return this.request<TeacherUser>('GET', '/api/auth/me');
  }

  // Class management endpoints
  async getClasses(): Promise<ApiResponse<ClassInfo[]>> {
    return this.request<ClassInfo[]>('GET', '/api/classes/');
  }

  async createClass(classData: Partial<ClassInfo>): Promise<ApiResponse<ClassInfo>> {
    return this.request<ClassInfo>('POST', '/api/classes/', classData);
  }

  async updateClass(classId: string, classData: Partial<ClassInfo>): Promise<ApiResponse<ClassInfo>> {
    return this.request<ClassInfo>('PUT', `/api/classes/${classId}`, classData);
  }

  async deleteClass(classId: string): Promise<ApiResponse> {
    return this.request('DELETE', `/api/classes/${classId}`);
  }

  async getClassStudents(classId: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('GET', `/api/classes/${classId}/students`);
  }

  async setClassAccess(accessData: AccessRequest): Promise<ApiResponse> {
    return this.request('POST', '/api/classes/set-access', accessData);
  }

  async importStudents(classId: string, csvData: string): Promise<ApiResponse> {
    return this.request('POST', `/api/classes/${classId}/import-students`, { csvData });
  }

  // Document management endpoints
  async getDocuments(): Promise<ApiResponse<Document[]>> {
    return this.request<Document[]>('GET', '/api/docs/');
  }

  async uploadDocument(file: File, classIds?: string[]): Promise<ApiResponse<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (classIds && classIds.length > 0) {
      classIds.forEach(classId => formData.append('class_ids', classId));
    }

    return this.request<UploadResponse>('POST', '/api/docs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async deleteDocument(documentId: string): Promise<ApiResponse> {
    return this.request('DELETE', `/api/docs/${documentId}`);
  }

  async assignDocumentToClasses(documentId: string, classIds: string[]): Promise<ApiResponse> {
    return this.request('POST', `/api/docs/${documentId}/assign`, { classIds });
  }

  async reindexDocument(documentId: string): Promise<ApiResponse> {
    return this.request('POST', `/api/docs/${documentId}/reindex`);
  }

  async getDocumentStatus(documentId: string): Promise<ApiResponse<{ status: string; progress?: number }>> {
    return this.request<{ status: string; progress?: number }>('GET', `/api/docs/${documentId}/status`);
  }

  // Audit log endpoints
  async getAuditLogs(filters: LogFilters = {}): Promise<ApiResponse<AuditLog[]>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, String(value));
        }
      }
    });

    const queryString = params.toString();
    const endpoint = `/api/audit/logs${queryString ? `?${queryString}` : ''}`;
    
    return this.request<AuditLog[]>('GET', endpoint);
  }

  async exportAuditLogs(filters: LogFilters = {}): Promise<ApiResponse<string>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, String(value));
        }
      }
    });

    const queryString = params.toString();
    const endpoint = `/api/audit/logs/export${queryString ? `?${queryString}` : ''}`;
    
    return this.request<string>('GET', endpoint);
  }

  async getAuditLogStats(filters: Partial<LogFilters> = {}): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, String(value));
        }
      }
    });

    const queryString = params.toString();
    const endpoint = `/api/audit/stats${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any>('GET', endpoint);
  }

  // Guardrail and Content Moderation endpoints
  async getGuardrailConfig(classId?: string): Promise<ApiResponse<any>> {
    const endpoint = classId ? `/api/guardrails/config/${classId}` : '/api/guardrails/config';
    return this.request<any>('GET', endpoint);
  }

  async updateGuardrailConfig(classId: string | undefined, config: any): Promise<ApiResponse<any>> {
    const endpoint = classId ? `/api/guardrails/config/${classId}` : '/api/guardrails/config';
    return this.request<any>('PUT', endpoint, config);
  }

  async getGuardrailViolations(filters: any = {}): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, String(value));
        }
      }
    });

    const queryString = params.toString();
    const endpoint = `/api/guardrails/violations${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any[]>('GET', endpoint);
  }

  async getUsageStats(classId?: string): Promise<ApiResponse<any>> {
    const endpoint = classId ? `/api/usage/stats/${classId}` : '/api/usage/stats';
    return this.request<any>('GET', endpoint);
  }

  async resetStudentQuestionCount(studentId: string): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/usage/reset/${studentId}`);
  }

  // System control endpoints
  async getSystemStatus(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/isolation/system-audit');
  }

  async updateSystemSettings(settings: any): Promise<ApiResponse> {
    return this.request('POST', '/api/settings', settings);
  }

  async getSystemSettings(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/settings');
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; service: string }>> {
    return this.request<{ status: string; service: string }>('GET', '/health');
  }

  // Utility methods
  updateBaseURL(newBaseURL: string) {
    this.baseURL = newBaseURL;
    this.client.defaults.baseURL = newBaseURL;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  // File download helper
  async downloadFile(url: string, filename: string): Promise<void> {
    try {
      const response = await this.client.get(url, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast.error('Failed to download file');
      throw error;
    }
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();