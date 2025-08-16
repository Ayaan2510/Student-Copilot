/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures and provides graceful degradation
 */

import { errorHandler, ErrorType } from './errorHandling';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  recoveryTimeout: number;       // Time to wait before trying again (ms)
  monitoringPeriod: number;      // Time window for failure counting (ms)
  successThreshold: number;      // Successes needed to close from half-open
  timeout: number;               // Request timeout (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private createdAt = new Date();
  private stateChangeListeners: Set<(state: CircuitState, stats: CircuitBreakerStats) => void> = new Set();

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  // Execute a function with circuit breaker protection
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.notifyStateChange();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);
      
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  // Execute operation with timeout
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Handle successful operation
  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  // Handle failed operation
  private onFailure(error: any): void {
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.failureCount++;

    // Log the failure
    errorHandler.handleError(error, {
      action: `circuit_breaker_failure_${this.name}`,
      additionalData: {
        circuitState: this.state,
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      }
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.open();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.shouldOpen()) {
        this.open();
      }
    }
  }

  // Check if circuit should be opened
  private shouldOpen(): boolean {
    return this.failureCount >= this.config.failureThreshold;
  }

  // Check if we should attempt to reset (move to half-open)
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  // Open the circuit
  private open(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    
    console.warn(`Circuit breaker OPENED for ${this.name} after ${this.failureCount} failures`);
    
    this.notifyStateChange();
  }

  // Reset the circuit to closed state
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    
    console.log(`Circuit breaker CLOSED for ${this.name} after recovery`);
    
    this.notifyStateChange();
  }

  // Get current statistics
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.createdAt.getTime()
    };
  }

  // Get current state
  getState(): CircuitState {
    return this.state;
  }

  // Check if circuit is healthy
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  // Force open the circuit (for testing or manual intervention)
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = new Date();
    this.notifyStateChange();
  }

  // Force close the circuit (for testing or manual intervention)
  forceClose(): void {
    this.reset();
  }

  // Subscribe to state changes
  onStateChange(callback: (state: CircuitState, stats: CircuitBreakerStats) => void): () => void {
    this.stateChangeListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  // Notify all state change listeners
  private notifyStateChange(): void {
    const stats = this.getStats();
    this.stateChangeListeners.forEach(callback => {
      try {
        callback(this.state, stats);
      } catch (error) {
        console.error('Error in circuit breaker state change listener:', error);
      }
    });
  }
}

// Circuit Breaker Manager
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
    successThreshold: 3,
    timeout: 30000 // 30 seconds
  };

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  // Get or create a circuit breaker
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const finalConfig = { ...this.defaultConfig, ...config };
      const breaker = new CircuitBreaker(name, finalConfig);
      
      // Set up logging for state changes
      breaker.onStateChange((state, stats) => {
        console.log(`Circuit breaker ${name} state changed to ${state}`, stats);
      });
      
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name)!;
  }

  // Execute operation with circuit breaker protection
  async execute<T>(
    name: string, 
    operation: () => Promise<T>, 
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(name, config);
    return breaker.execute(operation);
  }

  // Get all circuit breaker statistics
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  // Get health status of all circuit breakers
  getHealthStatus(): {
    healthy: string[];
    unhealthy: string[];
    total: number;
    healthyPercentage: number;
  } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];
    
    for (const [name, breaker] of this.breakers.entries()) {
      if (breaker.isHealthy()) {
        healthy.push(name);
      } else {
        unhealthy.push(name);
      }
    }
    
    const total = this.breakers.size;
    const healthyPercentage = total > 0 ? (healthy.length / total) * 100 : 100;
    
    return {
      healthy,
      unhealthy,
      total,
      healthyPercentage
    };
  }

  // Reset all circuit breakers
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
  }

  // Remove a circuit breaker
  removeBreaker(name: string): boolean {
    return this.breakers.delete(name);
  }

  // Clear all circuit breakers
  clear(): void {
    this.breakers.clear();
  }
}

// Predefined circuit breakers for common services
export const circuitBreakerManager = CircuitBreakerManager.getInstance();

// API Circuit Breaker
export const apiCircuitBreaker = circuitBreakerManager.getBreaker('api', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  successThreshold: 2,
  timeout: 15000 // 15 seconds
});

// Authentication Circuit Breaker
export const authCircuitBreaker = circuitBreakerManager.getBreaker('auth', {
  failureThreshold: 2,
  recoveryTimeout: 60000, // 1 minute
  successThreshold: 1,
  timeout: 10000 // 10 seconds
});

// Document Processing Circuit Breaker
export const documentCircuitBreaker = circuitBreakerManager.getBreaker('document', {
  failureThreshold: 5,
  recoveryTimeout: 120000, // 2 minutes
  successThreshold: 3,
  timeout: 60000 // 1 minute
});

// Convenience functions
export const executeWithCircuitBreaker = <T>(
  name: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> => {
  return circuitBreakerManager.execute(name, operation, config);
};

export const getCircuitBreakerStats = (name?: string) => {
  if (name) {
    const breaker = circuitBreakerManager.getBreaker(name);
    return breaker.getStats();
  }
  return circuitBreakerManager.getAllStats();
};

export const getSystemHealth = () => {
  return circuitBreakerManager.getHealthStatus();
};