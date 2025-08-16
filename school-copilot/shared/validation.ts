/**
 * Comprehensive Input Validation and Sanitization
 * Security-focused validation for all user inputs and API endpoints
 */

import DOMPurify from 'isomorphic-dompurify';

// Validation error types
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Validation result interface
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
  sanitized?: T;
}

// Security patterns and rules
const SECURITY_PATTERNS = {
  // XSS prevention patterns
  XSS_SCRIPT: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  XSS_JAVASCRIPT: /javascript:/gi,
  XSS_VBSCRIPT: /vbscript:/gi,
  XSS_ONLOAD: /on\w+\s*=/gi,
  
  // SQL injection patterns
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|('|('')|;|--|\*|\|)/gi,
  
  // Path traversal patterns
  PATH_TRAVERSAL: /\.\.[\/\\]/g,
  
  // Command injection patterns
  COMMAND_INJECTION: /[;&|`$(){}[\]]/g,
  
  // Email validation
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Safe text patterns
  SAFE_TEXT: /^[a-zA-Z0-9\s\-_.,!?()'"]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMERIC: /^[0-9]+$/,
  
  // ID patterns
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  OBJECT_ID: /^[a-f\d]{24}$/i,
  
  // URL validation
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  
  // File name validation
  SAFE_FILENAME: /^[a-zA-Z0-9\-_. ]+\.[a-zA-Z0-9]{1,10}$/,
  
  // Class/Student ID patterns
  CLASS_ID: /^[a-zA-Z0-9\-_]{3,50}$/,
  STUDENT_ID: /^[a-zA-Z0-9\-_.@]{3,100}$/
};

// Validation rules
export const ValidationRules = {
  // String validation
  string: {
    minLength: (min: number) => (value: string) => 
      value.length >= min || `Must be at least ${min} characters`,
    maxLength: (max: number) => (value: string) => 
      value.length <= max || `Must be no more than ${max} characters`,
    pattern: (pattern: RegExp, message: string) => (value: string) => 
      pattern.test(value) || message,
    noXSS: (value: string) => 
      !SECURITY_PATTERNS.XSS_SCRIPT.test(value) && 
      !SECURITY_PATTERNS.XSS_JAVASCRIPT.test(value) && 
      !SECURITY_PATTERNS.XSS_VBSCRIPT.test(value) && 
      !SECURITY_PATTERNS.XSS_ONLOAD.test(value) || 'Contains potentially dangerous content',
    noSQLInjection: (value: string) => 
      !SECURITY_PATTERNS.SQL_INJECTION.test(value) || 'Contains potentially dangerous SQL patterns',
    noPathTraversal: (value: string) => 
      !SECURITY_PATTERNS.PATH_TRAVERSAL.test(value) || 'Contains path traversal patterns',
    noCommandInjection: (value: string) => 
      !SECURITY_PATTERNS.COMMAND_INJECTION.test(value) || 'Contains command injection patterns'
  },
  
  // Email validation
  email: (value: string) => 
    SECURITY_PATTERNS.EMAIL.test(value) || 'Invalid email format',
  
  // URL validation
  url: (value: string) => 
    SECURITY_PATTERNS.URL.test(value) || 'Invalid URL format',
  
  // ID validation
  uuid: (value: string) => 
    SECURITY_PATTERNS.UUID.test(value) || 'Invalid UUID format',
  objectId: (value: string) => 
    SECURITY_PATTERNS.OBJECT_ID.test(value) || 'Invalid Object ID format',
  classId: (value: string) => 
    SECURITY_PATTERNS.CLASS_ID.test(value) || 'Invalid class ID format',
  studentId: (value: string) => 
    SECURITY_PATTERNS.STUDENT_ID.test(value) || 'Invalid student ID format',
  
  // Number validation
  number: {
    min: (min: number) => (value: number) => 
      value >= min || `Must be at least ${min}`,
    max: (max: number) => (value: number) => 
      value <= max || `Must be no more than ${max}`,
    integer: (value: number) => 
      Number.isInteger(value) || 'Must be an integer',
    positive: (value: number) => 
      value > 0 || 'Must be positive'
  },
  
  // Array validation
  array: {
    minLength: (min: number) => (value: any[]) => 
      value.length >= min || `Must have at least ${min} items`,
    maxLength: (max: number) => (value: any[]) => 
      value.length <= max || `Must have no more than ${max} items`,
    unique: (value: any[]) => 
      new Set(value).size === value.length || 'Must contain unique items'
  },
  
  // Required field validation
  required: (value: any) => 
    value !== null && value !== undefined && value !== '' || 'This field is required'
};

// Sanitization functions
export const Sanitizers = {
  // HTML sanitization
  html: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: []
    });
  },
  
  // Text sanitization
  text: (input: string): string => {
    return input
      .replace(SECURITY_PATTERNS.XSS_SCRIPT, '')
      .replace(SECURITY_PATTERNS.XSS_JAVASCRIPT, '')
      .replace(SECURITY_PATTERNS.XSS_VBSCRIPT, '')
      .replace(SECURITY_PATTERNS.XSS_ONLOAD, '')
      .trim();
  },
  
  // Query sanitization for search
  query: (input: string): string => {
    return input
      .replace(SECURITY_PATTERNS.SQL_INJECTION, '')
      .replace(SECURITY_PATTERNS.COMMAND_INJECTION, '')
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 1000); // Limit query length
  },
  
  // Filename sanitization
  filename: (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9\-_. ]/g, '')
      .replace(/\.{2,}/g, '.')
      .trim()
      .substring(0, 255);
  },
  
  // URL sanitization
  url: (input: string): string => {
    try {
      const url = new URL(input);
      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.toString();
    } catch {
      return '';
    }
  },
  
  // ID sanitization
  id: (input: string): string => {
    return input.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 100);
  },
  
  // Email sanitization
  email: (input: string): string => {
    return input.toLowerCase().trim().substring(0, 254);
  }
};

// Validator class
export class Validator {
  private errors: ValidationError[] = [];
  
  // Validate a single field
  validateField<T>(
    value: T,
    fieldName: string,
    rules: Array<(value: T) => string | boolean>
  ): ValidationResult<T> {
    this.errors = [];
    
    for (const rule of rules) {
      const result = rule(value);
      if (typeof result === 'string') {
        this.errors.push(new ValidationError(result, fieldName, 'VALIDATION_FAILED', value));
      }
    }
    
    return {
      isValid: this.errors.length === 0,
      data: value,
      errors: [...this.errors]
    };
  }
  
  // Validate an object against a schema
  validateObject<T extends Record<string, any>>(
    obj: T,
    schema: Record<keyof T, Array<(value: any) => string | boolean>>
  ): ValidationResult<T> {
    this.errors = [];
    const sanitized: Partial<T> = {};
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      const fieldResult = this.validateField(value, field, rules);
      
      if (!fieldResult.isValid) {
        this.errors.push(...fieldResult.errors);
      }
      
      sanitized[field as keyof T] = value;
    }
    
    return {
      isValid: this.errors.length === 0,
      data: obj,
      errors: [...this.errors],
      sanitized: sanitized as T
    };
  }
  
  // Get validation errors
  getErrors(): ValidationError[] {
    return [...this.errors];
  }
  
  // Clear errors
  clearErrors(): void {
    this.errors = [];
  }
}

// Predefined validation schemas
export const ValidationSchemas = {
  // Query request validation
  queryRequest: {
    studentId: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(100),
      ValidationRules.studentId,
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    classId: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(50),
      ValidationRules.classId,
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    query: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(2000),
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection,
      ValidationRules.string.noCommandInjection
    ],
    sessionId: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(100),
      ValidationRules.string.noXSS
    ]
  },
  
  // User authentication validation
  loginRequest: {
    email: [
      ValidationRules.required,
      ValidationRules.email,
      ValidationRules.string.maxLength(254),
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    domain: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(100),
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ]
  },
  
  // Class information validation
  classInfo: {
    id: [
      ValidationRules.required,
      ValidationRules.classId,
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    name: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(200),
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    description: [
      ValidationRules.string.maxLength(1000),
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ]
  },
  
  // Document upload validation
  documentUpload: {
    filename: [
      ValidationRules.required,
      ValidationRules.string.minLength(1),
      ValidationRules.string.maxLength(255),
      ValidationRules.string.pattern(SECURITY_PATTERNS.SAFE_FILENAME, 'Invalid filename format'),
      ValidationRules.string.noPathTraversal
    ],
    classIds: [
      ValidationRules.array.maxLength(50),
      (value: string[]) => value.every(id => SECURITY_PATTERNS.CLASS_ID.test(id)) || 'Invalid class ID format'
    ]
  },
  
  // Settings validation
  settings: {
    selectedClassId: [
      ValidationRules.classId,
      ValidationRules.string.noXSS,
      ValidationRules.string.noSQLInjection
    ],
    apiBaseUrl: [
      ValidationRules.url,
      ValidationRules.string.maxLength(500)
    ]
  }
};

// Rate limiting validation
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  // Check if request is allowed
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    // Check if under limit
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
  
  // Get remaining requests
  getRemaining(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
  
  // Get reset time
  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }
  
  // Clear requests for identifier
  clear(identifier: string): void {
    this.requests.delete(identifier);
  }
  
  // Clear all requests
  clearAll(): void {
    this.requests.clear();
  }
}

// Security utilities
export const SecurityUtils = {
  // Generate secure random string
  generateSecureToken: (length: number = 32): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    
    return result;
  },
  
  // Hash sensitive data
  hashData: async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
  
  // Validate CSRF token
  validateCSRFToken: (token: string, expectedToken: string): boolean => {
    if (!token || !expectedToken) return false;
    return token === expectedToken;
  },
  
  // Check for suspicious patterns
  isSuspiciousInput: (input: string): boolean => {
    const suspiciousPatterns = [
      SECURITY_PATTERNS.XSS_SCRIPT,
      SECURITY_PATTERNS.SQL_INJECTION,
      SECURITY_PATTERNS.COMMAND_INJECTION,
      /eval\s*\(/gi,
      /document\.cookie/gi,
      /window\.location/gi
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  },
  
  // Sanitize for logging (remove sensitive data)
  sanitizeForLogging: (obj: any): any => {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const sanitized = { ...obj };
    
    for (const key in sanitized) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = SecurityUtils.sanitizeForLogging(sanitized[key]);
      }
    }
    
    return sanitized;
  }
};

// Export convenience functions
export const validator = new Validator();
export const rateLimiter = new RateLimiter();

export const validateQueryRequest = (data: any) => 
  validator.validateObject(data, ValidationSchemas.queryRequest);

export const validateLoginRequest = (data: any) => 
  validator.validateObject(data, ValidationSchemas.loginRequest);

export const validateClassInfo = (data: any) => 
  validator.validateObject(data, ValidationSchemas.classInfo);

export const validateDocumentUpload = (data: any) => 
  validator.validateObject(data, ValidationSchemas.documentUpload);

export const sanitizeInput = (input: string, type: keyof typeof Sanitizers = 'text') => 
  Sanitizers[type](input);

export const isRateLimited = (identifier: string) => 
  !rateLimiter.isAllowed(identifier);