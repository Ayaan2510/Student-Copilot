/**
 * Comprehensive Error Handling System
 * Centralized error management with logging, recovery, and user feedback
 */

import { toast } from 'react-hot-toast';

// Error types and classifications
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  userId?: string;
  classId?: string;
  action?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

export interface SchoolCopilotError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context: ErrorContext;
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
  suggestedActions?: string[];
}

// Error classification rules
const ERROR_CLASSIFICATION_RULES = {
  // Network errors
  'Failed to fetch': { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  'NetworkError': { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  'ERR_NETWORK': { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  'ERR_INTERNET_DISCONNECTED': { type: ErrorType.OFFLINE, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true },
  
  // Authentication errors
  'Unauthorized': { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH, recoverable: true, retryable: false },
  'Invalid token': { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH, recoverable: true, retryable: false },
  'Token expired': { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: false },
  
  // Authorization errors
  'Forbidden': { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH, recoverable: false, retryable: false },
  'Access denied': { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH, recoverable: false, retryable: false },
  
  // Rate limiting
  'Too Many Requests': { type: ErrorType.RATE_LIMIT, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  'Rate limit exceeded': { type: ErrorType.RATE_LIMIT, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  
  // Server errors
  'Internal Server Error': { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true },
  'Service Unavailable': { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true },
  'Bad Gateway': { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true },
  
  // Timeout errors
  'Request timeout': { type: ErrorType.TIMEOUT, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  'ECONNABORTED': { type: ErrorType.TIMEOUT, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true },
  
  // Validation errors
  'Validation failed': { type: ErrorType.VALIDATION, severity: ErrorSeverity.LOW, recoverable: false, retryable: false },
  'Invalid input': { type: ErrorType.VALIDATION, severity: ErrorSeverity.LOW, recoverable: false, retryable: false }
};

// User-friendly error messages
const USER_ERROR_MESSAGES = {
  [ErrorType.NETWORK]: 'Connection problem. Please check your internet connection and try again.',
  [ErrorType.OFFLINE]: 'You appear to be offline. Please check your internet connection.',
  [ErrorType.AUTHENTICATION]: 'Please log in again to continue using School Co-Pilot.',
  [ErrorType.AUTHORIZATION]: 'You don\'t have permission to perform this action.',
  [ErrorType.RATE_LIMIT]: 'You\'re sending requests too quickly. Please wait a moment and try again.',
  [ErrorType.SERVER]: 'Our servers are experiencing issues. Please try again in a few moments.',
  [ErrorType.TIMEOUT]: 'The request took too long. Please try again.',
  [ErrorType.VALIDATION]: 'Please check your input and try again.',
  [ErrorType.CLIENT]: 'Something went wrong. Please refresh and try again.',
  [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

// Suggested actions for different error types
const SUGGESTED_ACTIONS = {
  [ErrorType.NETWORK]: [
    'Check your internet connection',
    'Try refreshing the page',
    'Disable VPN if using one',
    'Contact your network administrator'
  ],
  [ErrorType.OFFLINE]: [
    'Check your internet connection',
    'Try connecting to a different network',
    'Wait for connection to restore'
  ],
  [ErrorType.AUTHENTICATION]: [
    'Log out and log back in',
    'Clear browser cache and cookies',
    'Contact your teacher or administrator'
  ],
  [ErrorType.AUTHORIZATION]: [
    'Contact your teacher for access',
    'Verify you\'re in the correct class',
    'Check if your account is active'
  ],
  [ErrorType.RATE_LIMIT]: [
    'Wait a few seconds before trying again',
    'Reduce the frequency of your requests',
    'Contact support if this persists'
  ],
  [ErrorType.SERVER]: [
    'Wait a few minutes and try again',
    'Check our status page',
    'Contact support if the issue persists'
  ],
  [ErrorType.TIMEOUT]: [
    'Check your internet connection speed',
    'Try again with a simpler request',
    'Contact support if timeouts persist'
  ],
  [ErrorType.VALIDATION]: [
    'Check your input for errors',
    'Make sure all required fields are filled',
    'Try rephrasing your question'
  ]
};

// Error Handler Class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: SchoolCopilotError[] = [];
  private maxLogSize = 100;
  private retryAttempts = new Map<string, number>();
  private maxRetryAttempts = 3;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Set up global error handlers
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, {
        action: 'unhandled_promise_rejection',
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
      this.handleError(event.error, {
        action: 'javascript_error',
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });
  }

  // Main error handling method
  handleError(error: any, context: Partial<ErrorContext> = {}): SchoolCopilotError {
    const processedError = this.processError(error, context);
    this.logError(processedError);
    this.notifyUser(processedError);
    this.reportError(processedError);
    
    return processedError;
  }

  // Process and classify errors
  private processError(error: any, context: Partial<ErrorContext>): SchoolCopilotError {
    const errorId = this.generateErrorId();
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...context
    };

    let errorMessage = '';
    let originalError: Error | undefined;

    // Extract error message
    if (error instanceof Error) {
      errorMessage = error.message;
      originalError = error;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Unknown error occurred';
    }

    // Classify error
    const classification = this.classifyError(errorMessage, error);
    
    return {
      id: errorId,
      type: classification.type,
      severity: classification.severity,
      message: errorMessage,
      originalError,
      context: fullContext,
      recoverable: classification.recoverable,
      retryable: classification.retryable,
      userMessage: this.getUserMessage(classification.type, errorMessage),
      technicalDetails: this.getTechnicalDetails(error),
      suggestedActions: SUGGESTED_ACTIONS[classification.type] || []
    };
  }

  // Classify error based on message and type
  private classifyError(message: string, error: any): {
    type: ErrorType;
    severity: ErrorSeverity;
    recoverable: boolean;
    retryable: boolean;
  } {
    // Check for specific error patterns
    for (const [pattern, classification] of Object.entries(ERROR_CLASSIFICATION_RULES)) {
      if (message.includes(pattern)) {
        return classification;
      }
    }

    // Check HTTP status codes
    if (error?.status || error?.statusCode) {
      const status = error.status || error.statusCode;
      
      if (status === 401) {
        return { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH, recoverable: true, retryable: false };
      } else if (status === 403) {
        return { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH, recoverable: false, retryable: false };
      } else if (status === 429) {
        return { type: ErrorType.RATE_LIMIT, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: true };
      } else if (status >= 500) {
        return { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true };
      } else if (status >= 400) {
        return { type: ErrorType.CLIENT, severity: ErrorSeverity.MEDIUM, recoverable: false, retryable: false };
      }
    }

    // Check for network-related errors
    if (!navigator.onLine) {
      return { type: ErrorType.OFFLINE, severity: ErrorSeverity.HIGH, recoverable: true, retryable: true };
    }

    // Default classification
    return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM, recoverable: true, retryable: false };
  }

  // Get user-friendly error message
  private getUserMessage(type: ErrorType, originalMessage: string): string {
    const baseMessage = USER_ERROR_MESSAGES[type];
    
    // Add specific context for certain errors
    if (type === ErrorType.VALIDATION && originalMessage.includes('question')) {
      return 'Please check your question and try again.';
    }
    
    return baseMessage;
  }

  // Get technical details for debugging
  private getTechnicalDetails(error: any): string {
    const details: string[] = [];
    
    if (error?.stack) {
      details.push(`Stack: ${error.stack}`);
    }
    
    if (error?.status || error?.statusCode) {
      details.push(`Status: ${error.status || error.statusCode}`);
    }
    
    if (error?.response?.data) {
      details.push(`Response: ${JSON.stringify(error.response.data)}`);
    }
    
    return details.join('\n');
  }

  // Log error to local storage and console
  private logError(error: SchoolCopilotError): void {
    // Add to in-memory log
    this.errorLog.unshift(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Log to console based on severity
    const logMethod = error.severity === ErrorSeverity.CRITICAL ? 'error' :
                     error.severity === ErrorSeverity.HIGH ? 'error' :
                     error.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info';
    
    console[logMethod]('School Co-Pilot Error:', {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context,
      technicalDetails: error.technicalDetails
    });

    // Store in local storage for persistence
    try {
      const storedErrors = JSON.parse(localStorage.getItem('schoolCopilot_errorLog') || '[]');
      storedErrors.unshift({
        ...error,
        originalError: undefined, // Don't serialize Error objects
        context: {
          ...error.context,
          timestamp: error.context.timestamp.toISOString()
        }
      });
      
      // Keep only last 50 errors in storage
      const trimmedErrors = storedErrors.slice(0, 50);
      localStorage.setItem('schoolCopilot_errorLog', JSON.stringify(trimmedErrors));
    } catch (storageError) {
      console.warn('Failed to store error log:', storageError);
    }
  }

  // Notify user about the error
  private notifyUser(error: SchoolCopilotError): void {
    // Don't show notifications for low severity errors
    if (error.severity === ErrorSeverity.LOW) {
      return;
    }

    // Show appropriate notification based on severity
    const toastOptions = {
      duration: error.severity === ErrorSeverity.CRITICAL ? 0 : // Persistent for critical
                error.severity === ErrorSeverity.HIGH ? 8000 :
                error.severity === ErrorSeverity.MEDIUM ? 5000 : 3000,
      id: error.id
    };

    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      toast.error(error.userMessage, toastOptions);
    } else {
      toast(error.userMessage, toastOptions);
    }
  }

  // Report error to backend (if available)
  private async reportError(error: SchoolCopilotError): Promise<void> {
    // Only report medium and high severity errors
    if (error.severity === ErrorSeverity.LOW) {
      return;
    }

    try {
      // Check if we can reach the backend
      if (navigator.onLine) {
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: error.id,
            type: error.type,
            severity: error.severity,
            message: error.message,
            context: error.context,
            technicalDetails: error.technicalDetails
          })
        });
      }
    } catch (reportingError) {
      console.warn('Failed to report error to backend:', reportingError);
    }
  }

  // Retry mechanism
  async retry<T>(
    operation: () => Promise<T>,
    errorContext: Partial<ErrorContext> = {},
    maxAttempts: number = this.maxRetryAttempts
  ): Promise<T> {
    const operationId = this.generateErrorId();
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry count on success
        this.retryAttempts.delete(operationId);
        
        return result;
      } catch (error) {
        lastError = error;
        
        const processedError = this.processError(error, {
          ...errorContext,
          action: `retry_attempt_${attempt}`
        });

        // Don't retry if error is not retryable
        if (!processedError.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    this.handleError(lastError, {
      ...errorContext,
      action: 'retry_exhausted'
    });
    
    throw lastError;
  }

  // Get error history
  getErrorHistory(): SchoolCopilotError[] {
    return [...this.errorLog];
  }

  // Clear error history
  clearErrorHistory(): void {
    this.errorLog = [];
    localStorage.removeItem('schoolCopilot_errorLog');
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if error is recoverable
  isRecoverable(error: SchoolCopilotError): boolean {
    return error.recoverable;
  }

  // Check if error is retryable
  isRetryable(error: SchoolCopilotError): boolean {
    return error.retryable;
  }
}

// Convenience functions
export const errorHandler = ErrorHandler.getInstance();

export const handleError = (error: any, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, context);
};

export const retryOperation = <T>(
  operation: () => Promise<T>,
  context?: Partial<ErrorContext>,
  maxAttempts?: number
) => {
  return errorHandler.retry(operation, context, maxAttempts);
};

export const getErrorHistory = () => {
  return errorHandler.getErrorHistory();
};

export const clearErrorHistory = () => {
  errorHandler.clearErrorHistory();
};