/**
 * Error Testing Utilities
 * Comprehensive testing framework for error scenarios and recovery mechanisms
 */

import { errorHandler, ErrorType, ErrorSeverity } from './errorHandling';
import { offlineManager } from './offlineSupport';
import { circuitBreakerManager, CircuitState } from './circuitBreaker';
import { QueryRequest } from '@shared/types';

export interface TestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: () => Promise<any>;
  verify: (result: any, error?: any) => boolean;
  cleanup: () => Promise<void>;
  expectedError?: ErrorType;
  timeout?: number;
}

export interface TestResult {
  scenario: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  scenarios: TestScenario[];
}

// Error Testing Framework
export class ErrorTestingFramework {
  private static instance: ErrorTestingFramework;
  private testResults: TestResult[] = [];
  private isRunning = false;

  private constructor() {}

  static getInstance(): ErrorTestingFramework {
    if (!ErrorTestingFramework.instance) {
      ErrorTestingFramework.instance = new ErrorTestingFramework();
    }
    return ErrorTestingFramework.instance;
  }

  // Run a single test scenario
  async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    let result: TestResult = {
      scenario: scenario.name,
      passed: false,
      duration: 0
    };

    try {
      console.log(`Running test scenario: ${scenario.name}`);
      
      // Setup
      await scenario.setup();
      
      // Execute with timeout
      const timeoutMs = scenario.timeout || 30000;
      const executePromise = scenario.execute();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), timeoutMs);
      });
      
      let executeResult: any;
      let executeError: any;
      
      try {
        executeResult = await Promise.race([executePromise, timeoutPromise]);
      } catch (error) {
        executeError = error;
      }
      
      // Verify
      const passed = scenario.verify(executeResult, executeError);
      
      result = {
        scenario: scenario.name,
        passed,
        duration: Date.now() - startTime,
        error: executeError?.message,
        details: {
          result: executeResult,
          error: executeError
        }
      };
      
      // Cleanup
      await scenario.cleanup();
      
    } catch (error) {
      result = {
        scenario: scenario.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    this.testResults.push(result);
    console.log(`Test ${result.passed ? 'PASSED' : 'FAILED'}: ${scenario.name} (${result.duration}ms)`);
    
    return result;
  }

  // Run a test suite
  async runSuite(suite: TestSuite): Promise<TestResult[]> {
    console.log(`Running test suite: ${suite.name}`);
    this.isRunning = true;
    
    const results: TestResult[] = [];
    
    for (const scenario of suite.scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }
    
    this.isRunning = false;
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`Test suite completed: ${passed}/${total} tests passed`);
    
    return results;
  }

  // Get test results
  getResults(): TestResult[] {
    return [...this.testResults];
  }

  // Clear test results
  clearResults(): void {
    this.testResults = [];
  }

  // Check if tests are running
  isTestRunning(): boolean {
    return this.isRunning;
  }
}

// Predefined test scenarios
export const ERROR_TEST_SCENARIOS: TestSuite[] = [
  {
    name: 'Network Error Handling',
    scenarios: [
      {
        name: 'Network Failure Recovery',
        description: 'Test handling of network failures and automatic retry',
        setup: async () => {
          // Mock network failure
          const originalFetch = window.fetch;
          (window as any).originalFetch = originalFetch;
          window.fetch = () => Promise.reject(new Error('Network error'));
        },
        execute: async () => {
          const request: QueryRequest = {
            studentId: 'test-student',
            classId: 'test-class',
            query: 'Test query',
            timestamp: new Date(),
            sessionId: 'test-session'
          };
          
          // This should fail and be queued
          return offlineManager.queueQuery(request);
        },
        verify: (result, error) => {
          // Should successfully queue the query
          return typeof result === 'string' && result.startsWith('query_');
        },
        cleanup: async () => {
          // Restore original fetch
          if ((window as any).originalFetch) {
            window.fetch = (window as any).originalFetch;
            delete (window as any).originalFetch;
          }
        }
      },
      
      {
        name: 'Offline Detection',
        description: 'Test offline state detection and handling',
        setup: async () => {
          // Mock offline state
          Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false
          });
          
          // Trigger offline event
          window.dispatchEvent(new Event('offline'));
        },
        execute: async () => {
          return offlineManager.getConnectionState();
        },
        verify: (result) => {
          return result && !result.isOnline;
        },
        cleanup: async () => {
          // Restore online state
          Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true
          });
          
          window.dispatchEvent(new Event('online'));
        }
      }
    ]
  },
  
  {
    name: 'Circuit Breaker Testing',
    scenarios: [
      {
        name: 'Circuit Breaker Opens on Failures',
        description: 'Test that circuit breaker opens after threshold failures',
        setup: async () => {
          circuitBreakerManager.clear();
        },
        execute: async () => {
          const breaker = circuitBreakerManager.getBreaker('test-service', {
            failureThreshold: 3,
            recoveryTimeout: 1000,
            successThreshold: 1,
            timeout: 1000
          });
          
          // Cause failures to open circuit
          const failures = [];
          for (let i = 0; i < 5; i++) {
            try {
              await breaker.execute(() => Promise.reject(new Error('Test failure')));
            } catch (error) {
              failures.push(error);
            }
          }
          
          return {
            failures: failures.length,
            state: breaker.getState(),
            stats: breaker.getStats()
          };
        },
        verify: (result) => {
          return result && 
                 result.failures >= 3 && 
                 result.state === CircuitState.OPEN;
        },
        cleanup: async () => {
          circuitBreakerManager.clear();
        }
      },
      
      {
        name: 'Circuit Breaker Recovery',
        description: 'Test circuit breaker recovery after timeout',
        setup: async () => {
          circuitBreakerManager.clear();
        },
        execute: async () => {
          const breaker = circuitBreakerManager.getBreaker('test-recovery', {
            failureThreshold: 2,
            recoveryTimeout: 100, // Short timeout for testing
            successThreshold: 1,
            timeout: 1000
          });
          
          // Open the circuit
          try {
            await breaker.execute(() => Promise.reject(new Error('Failure 1')));
          } catch {}
          try {
            await breaker.execute(() => Promise.reject(new Error('Failure 2')));
          } catch {}
          
          const openState = breaker.getState();
          
          // Wait for recovery timeout
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Try a successful operation
          await breaker.execute(() => Promise.resolve('success'));
          
          return {
            openState,
            finalState: breaker.getState()
          };
        },
        verify: (result) => {
          return result && 
                 result.openState === CircuitState.OPEN &&
                 result.finalState === CircuitState.CLOSED;
        },
        cleanup: async () => {
          circuitBreakerManager.clear();
        }
      }
    ]
  },
  
  {
    name: 'Error Classification',
    scenarios: [
      {
        name: 'Authentication Error Classification',
        description: 'Test proper classification of authentication errors',
        setup: async () => {
          errorHandler.clearErrorHistory();
        },
        execute: async () => {
          const error = new Error('Unauthorized');
          return errorHandler.handleError(error, {
            action: 'test_auth_error'
          });
        },
        verify: (result) => {
          return result && 
                 result.type === ErrorType.AUTHENTICATION &&
                 result.severity === ErrorSeverity.HIGH;
        },
        cleanup: async () => {
          errorHandler.clearErrorHistory();
        }
      },
      
      {
        name: 'Rate Limit Error Classification',
        description: 'Test proper classification of rate limit errors',
        setup: async () => {
          errorHandler.clearErrorHistory();
        },
        execute: async () => {
          const error = { status: 429, message: 'Too Many Requests' };
          return errorHandler.handleError(error, {
            action: 'test_rate_limit_error'
          });
        },
        verify: (result) => {
          return result && 
                 result.type === ErrorType.RATE_LIMIT &&
                 result.retryable === true;
        },
        cleanup: async () => {
          errorHandler.clearErrorHistory();
        }
      }
    ]
  },
  
  {
    name: 'Cache and Queue Management',
    scenarios: [
      {
        name: 'Query Caching',
        description: 'Test query response caching functionality',
        setup: async () => {
          offlineManager.clearCache();
        },
        execute: async () => {
          const request: QueryRequest = {
            studentId: 'test-student',
            classId: 'test-class',
            query: 'Test cached query',
            timestamp: new Date(),
            sessionId: 'test-session'
          };
          
          const response = {
            answer: 'Test answer',
            citations: [],
            usedDocuments: [],
            confidence: 0.9,
            processingTime: 100,
            success: true
          };
          
          // Cache the response
          offlineManager.cacheResponse(request, response);
          
          // Retrieve from cache
          const cached = offlineManager.getCachedResponse(request);
          
          return {
            cached,
            matches: cached?.answer === response.answer
          };
        },
        verify: (result) => {
          return result && result.cached && result.matches;
        },
        cleanup: async () => {
          offlineManager.clearCache();
        }
      },
      
      {
        name: 'Queue Management',
        description: 'Test query queue management and prioritization',
        setup: async () => {
          offlineManager.clearCache();
        },
        execute: async () => {
          const requests = [
            {
              studentId: 'test-student',
              classId: 'test-class',
              query: 'Low priority query',
              timestamp: new Date(),
              sessionId: 'test-session-1'
            },
            {
              studentId: 'test-student',
              classId: 'test-class',
              query: 'High priority query',
              timestamp: new Date(),
              sessionId: 'test-session-2'
            }
          ];
          
          // Queue with different priorities
          const lowId = offlineManager.queueQuery(requests[0], 'low');
          const highId = offlineManager.queueQuery(requests[1], 'high');
          
          const queued = offlineManager.getQueuedQueries();
          
          return {
            lowId,
            highId,
            queued,
            highPriorityFirst: queued[0]?.priority === 'high'
          };
        },
        verify: (result) => {
          return result && 
                 result.queued.length === 2 &&
                 result.highPriorityFirst;
        },
        cleanup: async () => {
          offlineManager.clearCache();
        }
      }
    ]
  }
];

// Test runner functions
export const testingFramework = ErrorTestingFramework.getInstance();

export const runErrorTests = async (suiteName?: string): Promise<TestResult[]> => {
  const suitesToRun = suiteName 
    ? ERROR_TEST_SCENARIOS.filter(suite => suite.name === suiteName)
    : ERROR_TEST_SCENARIOS;
  
  const allResults: TestResult[] = [];
  
  for (const suite of suitesToRun) {
    const results = await testingFramework.runSuite(suite);
    allResults.push(...results);
  }
  
  return allResults;
};

export const runSingleTest = async (scenarioName: string): Promise<TestResult | null> => {
  for (const suite of ERROR_TEST_SCENARIOS) {
    const scenario = suite.scenarios.find(s => s.name === scenarioName);
    if (scenario) {
      return await testingFramework.runScenario(scenario);
    }
  }
  
  console.error(`Test scenario not found: ${scenarioName}`);
  return null;
};

export const getTestResults = (): TestResult[] => {
  return testingFramework.getResults();
};

export const clearTestResults = (): void => {
  testingFramework.clearResults();
};

// Development helper functions
export const simulateNetworkError = (): void => {
  const originalFetch = window.fetch;
  (window as any).originalFetch = originalFetch;
  
  window.fetch = () => Promise.reject(new Error('Simulated network error'));
  
  console.log('Network errors simulated. Call restoreNetwork() to restore.');
};

export const restoreNetwork = (): void => {
  if ((window as any).originalFetch) {
    window.fetch = (window as any).originalFetch;
    delete (window as any).originalFetch;
    console.log('Network restored.');
  }
};

export const simulateOffline = (): void => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  window.dispatchEvent(new Event('offline'));
  console.log('Offline mode simulated. Call restoreOnline() to restore.');
};

export const restoreOnline = (): void => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
  
  window.dispatchEvent(new Event('online'));
  console.log('Online mode restored.');
};

export const triggerTestError = (type: ErrorType = ErrorType.UNKNOWN): void => {
  const error = new Error(`Test error of type: ${type}`);
  errorHandler.handleError(error, {
    action: 'manual_test_error',
    additionalData: { testType: type }
  });
};

// Export test scenarios for external use
export { ERROR_TEST_SCENARIOS };