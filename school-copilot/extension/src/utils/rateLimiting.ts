/**
 * Rate Limiting System
 * Client-side rate limiting for API requests and user actions
 */

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (context: any) => string;
  onLimitReached?: (key: string, resetTime: Date) => void;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
}

// Rate limit entry
interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

// Rate limiter class
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  // Check if request is allowed
  checkLimit(context: any = {}): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(context) : 'default';
    const now = new Date();
    
    let entry = this.store.get(key);
    
    // Create new entry if doesn't exist or expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: new Date(now.getTime() + this.config.windowMs),
        firstRequest: now
      };
      this.store.set(key, entry);
    }
    
    const info: RateLimitInfo = {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: Math.max(0, entry.resetTime.getTime() - now.getTime())
    };
    
    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      if (this.config.onLimitReached) {
        this.config.onLimitReached(key, entry.resetTime);
      }
      
      return {
        allowed: false,
        info
      };
    }
    
    // Increment counter
    entry.count++;
    this.store.set(key, entry);
    
    info.remaining = Math.max(0, this.config.maxRequests - entry.count);
    
    return {
      allowed: true,
      info
    };
  }
  
  // Reset limit for a specific key
  reset(context: any = {}): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(context) : 'default';
    this.store.delete(key);
  }
  
  // Get current limit info without incrementing
  getInfo(context: any = {}): RateLimitInfo {
    const key = this.config.keyGenerator ? this.config.keyGenerator(context) : 'default';
    const now = new Date();
    
    const entry = this.store.get(key);
    
    if (!entry || now >= entry.resetTime) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: new Date(now.getTime() + this.config.windowMs),
        retryAfter: 0
      };
    }
    
    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: Math.max(0, entry.resetTime.getTime() - now.getTime())
    };
  }
  
  // Clean up expired entries
  private cleanup(): void {
    const now = new Date();
    
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
  
  // Destroy the rate limiter
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Rate limiter manager
export class RateLimiterManager {
  private static instance: RateLimiterManager;
  private limiters = new Map<string, RateLimiter>();

  private constructor() {}

  static getInstance(): RateLimiterManager {
    if (!RateLimiterManager.instance) {
      RateLimiterManager.instance = new RateLimiterManager();
    }
    return RateLimiterManager.instance;
  }

  // Create or get a rate limiter
  getLimiter(name: string, config: RateLimitConfig): RateLimiter {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new RateLimiter(config));
    }
    return this.limiters.get(name)!;
  }

  // Remove a rate limiter
  removeLimiter(name: string): boolean {
    const limiter = this.limiters.get(name);
    if (limiter) {
      limiter.destroy();
      return this.limiters.delete(name);
    }
    return false;
  }

  // Clear all rate limiters
  clear(): void {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

// Predefined rate limiters
const manager = RateLimiterManager.getInstance();

// Query rate limiter (10 queries per minute)
export const queryRateLimiter = manager.getLimiter('query', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (context) => `query_${context.studentId || 'anonymous'}`,
  onLimitReached: (key, resetTime) => {
    console.warn(`Query rate limit exceeded for ${key}. Reset at ${resetTime}`);
  }
});

// Authentication rate limiter (5 attempts per hour)
export const authRateLimiter = manager.getLimiter('auth', {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyGenerator: (context) => `auth_${context.email || context.ip || 'anonymous'}`,
  onLimitReached: (key, resetTime) => {
    console.warn(`Auth rate limit exceeded for ${key}. Reset at ${resetTime}`);
  }
});

// Document upload rate limiter (20 uploads per hour)
export const uploadRateLimiter = manager.getLimiter('upload', {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20,
  keyGenerator: (context) => `upload_${context.teacherId || 'anonymous'}`,
  onLimitReached: (key, resetTime) => {
    console.warn(`Upload rate limit exceeded for ${key}. Reset at ${resetTime}`);
  }
});

// API request rate limiter (60 requests per minute)
export const apiRateLimiter = manager.getLimiter('api', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  keyGenerator: (context) => `api_${context.userId || context.ip || 'anonymous'}`,
  onLimitReached: (key, resetTime) => {
    console.warn(`API rate limit exceeded for ${key}. Reset at ${resetTime}`);
  }
});

// Rate limiting middleware function
export const withRateLimit = <T extends any[], R>(
  limiter: RateLimiter,
  fn: (...args: T) => Promise<R>,
  context: any = {}
) => {
  return async (...args: T): Promise<R> => {
    const result = limiter.checkLimit(context);
    
    if (!result.allowed) {
      const error = new Error('Rate limit exceeded');
      (error as any).rateLimitInfo = result.info;
      (error as any).retryAfter = result.info.retryAfter;
      throw error;
    }
    
    return fn(...args);
  };
};

// Rate limiting decorator
export const rateLimit = (limiterName: string, config?: RateLimitConfig) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    const limiter = config 
      ? manager.getLimiter(limiterName, config)
      : manager.getLimiter(limiterName, {
          windowMs: 60 * 1000,
          maxRequests: 10
        });

    descriptor.value = async function (...args: any[]) {
      const context = { instance: this, method: propertyName, args };
      const result = limiter.checkLimit(context);
      
      if (!result.allowed) {
        const error = new Error(`Rate limit exceeded for ${propertyName}`);
        (error as any).rateLimitInfo = result.info;
        throw error;
      }
      
      return method.apply(this, args);
    };

    return descriptor;
  };
};

// Utility functions
export const checkQueryRateLimit = (studentId: string): RateLimitResult => {
  return queryRateLimiter.checkLimit({ studentId });
};

export const checkAuthRateLimit = (email: string): RateLimitResult => {
  return authRateLimiter.checkLimit({ email });
};

export const checkUploadRateLimit = (teacherId: string): RateLimitResult => {
  return uploadRateLimiter.checkLimit({ teacherId });
};

export const checkApiRateLimit = (userId: string): RateLimitResult => {
  return apiRateLimiter.checkLimit({ userId });
};

// Rate limit error class
export class RateLimitError extends Error {
  constructor(
    message: string,
    public rateLimitInfo: RateLimitInfo
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Rate limit status for UI
export interface RateLimitStatus {
  queries: RateLimitInfo;
  auth: RateLimitInfo;
  uploads: RateLimitInfo;
  api: RateLimitInfo;
}

export const getRateLimitStatus = (context: {
  studentId?: string;
  email?: string;
  teacherId?: string;
  userId?: string;
}): RateLimitStatus => {
  return {
    queries: queryRateLimiter.getInfo({ studentId: context.studentId }),
    auth: authRateLimiter.getInfo({ email: context.email }),
    uploads: uploadRateLimiter.getInfo({ teacherId: context.teacherId }),
    api: apiRateLimiter.getInfo({ userId: context.userId })
  };
};

// Persistent rate limiting (using localStorage)
export class PersistentRateLimiter extends RateLimiter {
  private storageKey: string;

  constructor(config: RateLimitConfig, storageKey: string) {
    super(config);
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        for (const [key, entry] of Object.entries(data)) {
          this.store.set(key, {
            ...entry as any,
            resetTime: new Date((entry as any).resetTime),
            firstRequest: new Date((entry as any).firstRequest)
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load rate limit data from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data: any = {};
      for (const [key, entry] of this.store.entries()) {
        data[key] = {
          ...entry,
          resetTime: entry.resetTime.toISOString(),
          firstRequest: entry.firstRequest.toISOString()
        };
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save rate limit data to storage:', error);
    }
  }

  checkLimit(context: any = {}): RateLimitResult {
    const result = super.checkLimit(context);
    this.saveToStorage();
    return result;
  }

  reset(context: any = {}): void {
    super.reset(context);
    this.saveToStorage();
  }
}

// Export the manager instance
export const rateLimiterManager = manager;