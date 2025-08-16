/**
 * Chrome Extension Security Configuration
 * Security hardening and validation for the Chrome extension
 */

import { validateQueryRequest, sanitizeInput, isRateLimited, SecurityUtils } from '@shared/validation';
import { secureStorage } from '../utils/secureStorage';

// Extension security manager
export class ExtensionSecurity {
  private static instance: ExtensionSecurity;
  private allowedOrigins: Set<string> = new Set();
  private trustedDomains: Set<string> = new Set();
  private sessionToken: string | null = null;
  private csrfToken: string | null = null;

  private constructor() {
    this.initializeSecurity();
  }

  static getInstance(): ExtensionSecurity {
    if (!ExtensionSecurity.instance) {
      ExtensionSecurity.instance = new ExtensionSecurity();
    }
    return ExtensionSecurity.instance;
  }

  private async initializeSecurity(): Promise<void> {
    // Set allowed origins
    this.allowedOrigins.add('https://school-copilot.com');
    this.allowedOrigins.add('https://api.school-copilot.com');
    this.allowedOrigins.add('https://dashboard.school-copilot.com');
    
    // Set trusted domains for content scripts
    this.trustedDomains.add('*.edu');
    this.trustedDomains.add('*.school.com');
    this.trustedDomains.add('classroom.google.com');
    this.trustedDomains.add('canvas.instructure.com');
    this.trustedDomains.add('blackboard.com');
    
    // Initialize secure storage
    await secureStorage.initialize();
    
    // Load session token
    this.sessionToken = await secureStorage.getAuthToken();
    
    // Generate CSRF token
    this.csrfToken = SecurityUtils.generateSecureToken(32);
  }

  // Validate message origin
  validateOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      
      // Check against allowed origins
      if (this.allowedOrigins.has(origin)) {
        return true;
      }
      
      // Check against trusted domain patterns
      for (const domain of this.trustedDomains) {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.substring(2);
          if (url.hostname.endsWith(baseDomain)) {
            return true;
          }
        } else if (url.hostname === domain) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  // Validate and sanitize query request
  async validateQueryRequest(request: any): Promise<{
    isValid: boolean;
    sanitized?: any;
    errors?: string[];
  }> {
    try {
      // Basic structure validation
      if (!request || typeof request !== 'object') {
        return { isValid: false, errors: ['Invalid request format'] };
      }

      // Validate using shared validation
      const validation = validateQueryRequest(request);
      if (!validation.isValid) {
        return {
          isValid: false,
          errors: validation.errors.map(e => e.message)
        };
      }

      // Additional security checks
      const errors: string[] = [];
      
      // Check query length
      if (request.query && request.query.length > 2000) {
        errors.push('Query too long');
      }
      
      // Check for suspicious content
      if (SecurityUtils.isSuspiciousInput(request.query)) {
        errors.push('Query contains suspicious content');
      }
      
      // Rate limiting check
      const rateLimitKey = `query:${request.studentId}`;
      if (isRateLimited(rateLimitKey)) {
        errors.push('Rate limit exceeded');
      }
      
      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      // Sanitize the request
      const sanitized = {
        ...request,
        query: sanitizeInput(request.query, 'query'),
        studentId: sanitizeInput(request.studentId, 'id'),
        classId: sanitizeInput(request.classId, 'id'),
        sessionId: sanitizeInput(request.sessionId, 'id')
      };

      return { isValid: true, sanitized };
      
    } catch (error) {
      console.error('Query validation failed:', error);
      return { isValid: false, errors: ['Validation error'] };
    }
  }

  // Validate content script injection
  validateContentScriptInjection(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Block dangerous protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // Block internal/local addresses
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' || 
          hostname.startsWith('127.') || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')) {
        return false;
      }
      
      // Check against trusted domains
      return Array.from(this.trustedDomains).some(domain => {
        if (domain.startsWith('*.')) {
          return hostname.endsWith(domain.substring(2));
        }
        return hostname === domain;
      });
      
    } catch {
      return false;
    }
  }

  // Secure message passing
  async sendSecureMessage(message: any, origin?: string): Promise<any> {
    // Validate origin if provided
    if (origin && !this.validateOrigin(origin)) {
      throw new Error('Invalid origin');
    }

    // Add security headers to message
    const secureMessage = {
      ...message,
      timestamp: Date.now(),
      nonce: SecurityUtils.generateSecureToken(16),
      csrfToken: this.csrfToken
    };

    // Sign the message
    const signature = await this.signMessage(secureMessage);
    secureMessage.signature = signature;

    return secureMessage;
  }

  // Verify received message
  async verifyMessage(message: any): Promise<boolean> {
    try {
      if (!message || !message.signature || !message.timestamp || !message.nonce) {
        return false;
      }

      // Check message age (max 5 minutes)
      const messageAge = Date.now() - message.timestamp;
      if (messageAge > 5 * 60 * 1000) {
        return false;
      }

      // Verify signature
      const { signature, ...messageWithoutSignature } = message;
      const expectedSignature = await this.signMessage(messageWithoutSignature);
      
      return signature === expectedSignature;
      
    } catch {
      return false;
    }
  }

  // Sign message with session token
  private async signMessage(message: any): Promise<string> {
    const messageString = JSON.stringify(message);
    const key = this.sessionToken || 'default-key';
    const data = `${messageString}:${key}`;
    
    return await SecurityUtils.hashData(data);
  }

  // Update session token
  async updateSessionToken(token: string): Promise<void> {
    this.sessionToken = token;
    await secureStorage.storeAuthToken(token);
  }

  // Clear security data
  async clearSecurityData(): Promise<void> {
    this.sessionToken = null;
    this.csrfToken = SecurityUtils.generateSecureToken(32);
    await secureStorage.clearAll();
  }

  // Get security status
  getSecurityStatus(): {
    hasSessionToken: boolean;
    allowedOrigins: number;
    trustedDomains: number;
    csrfTokenPresent: boolean;
  } {
    return {
      hasSessionToken: !!this.sessionToken,
      allowedOrigins: this.allowedOrigins.size,
      trustedDomains: this.trustedDomains.size,
      csrfTokenPresent: !!this.csrfToken
    };
  }
}

// Content Security Policy for extension
export const EXTENSION_CSP = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"], // Needed for dynamic styles
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'", "https://api.school-copilot.com", "https://dashboard.school-copilot.com"],
  "font-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": []
};

// Secure communication utilities
export class SecureCommunication {
  private static nonces: Set<string> = new Set();
  private static maxNonceAge = 5 * 60 * 1000; // 5 minutes
  
  // Generate and track nonce
  static generateNonce(): string {
    const nonce = SecurityUtils.generateSecureToken(16);
    this.nonces.add(nonce);
    
    // Clean old nonces
    setTimeout(() => {
      this.nonces.delete(nonce);
    }, this.maxNonceAge);
    
    return nonce;
  }
  
  // Validate nonce
  static validateNonce(nonce: string): boolean {
    return this.nonces.has(nonce);
  }
  
  // Encrypt sensitive data for storage
  static async encryptForStorage(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    // In a real implementation, use Web Crypto API
    return btoa(jsonString); // Simple base64 encoding for demo
  }
  
  // Decrypt sensitive data from storage
  static async decryptFromStorage(encryptedData: string): Promise<any> {
    try {
      const jsonString = atob(encryptedData);
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }
}

// Permission validation
export class PermissionValidator {
  private static requiredPermissions = [
    'activeTab',
    'sidePanel',
    'storage'
  ];
  
  private static optionalPermissions = [
    'contextMenus'
  ];
  
  // Check if extension has required permissions
  static async validatePermissions(): Promise<{
    hasRequired: boolean;
    hasOptional: boolean;
    missing: string[];
  }> {
    const permissions = await chrome.permissions.getAll();
    const currentPermissions = new Set(permissions.permissions || []);
    
    const missingRequired = this.requiredPermissions.filter(
      perm => !currentPermissions.has(perm)
    );
    
    const missingOptional = this.optionalPermissions.filter(
      perm => !currentPermissions.has(perm)
    );
    
    return {
      hasRequired: missingRequired.length === 0,
      hasOptional: missingOptional.length === 0,
      missing: [...missingRequired, ...missingOptional]
    };
  }
  
  // Request missing permissions
  static async requestMissingPermissions(): Promise<boolean> {
    const validation = await this.validatePermissions();
    
    if (validation.missing.length === 0) {
      return true;
    }
    
    try {
      const granted = await chrome.permissions.request({
        permissions: validation.missing
      });
      
      return granted;
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return false;
    }
  }
}

// Export main security instance
export const extensionSecurity = ExtensionSecurity.getInstance();

// Export utility functions
export const validateOrigin = (origin: string) => extensionSecurity.validateOrigin(origin);
export const validateQuery = (request: any) => extensionSecurity.validateQueryRequest(request);
export const sendSecureMessage = (message: any, origin?: string) => extensionSecurity.sendSecureMessage(message, origin);
export const verifyMessage = (message: any) => extensionSecurity.verifyMessage(message);
export const getSecurityStatus = () => extensionSecurity.getSecurityStatus();