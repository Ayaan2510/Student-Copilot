/**
 * Error Recovery Components
 * UI components for error handling, recovery, and offline support
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clock, 
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Activity,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { LoadingSpinner } from './LoadingStates';
import { 
  SchoolCopilotError, 
  ErrorType, 
  ErrorSeverity, 
  errorHandler, 
  getErrorHistory 
} from '../utils/errorHandling';
import { 
  offlineManager, 
  OfflineState, 
  CachedQuery, 
  onConnectionChange,
  getQueuedQueries,
  getCacheStats 
} from '../utils/offlineSupport';
import { 
  circuitBreakerManager, 
  CircuitState, 
  getSystemHealth 
} from '../utils/circuitBreaker';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

// Error Boundary Component
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `boundary_${Date.now()}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const processedError = errorHandler.handleError(error, {
      action: 'react_error_boundary',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    this.setState({ errorId: processedError.id });
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Default Error Fallback Component
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => {
  return (
    <div className="error-fallback p-6 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-4">
        We encountered an unexpected error. Please try refreshing the page.
      </p>
      <div className="space-x-3">
        <Button onClick={retry} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Try Again
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh Page
        </Button>
      </div>
      <details className="mt-4 text-left">
        <summary className="cursor-pointer text-sm text-gray-500">Technical Details</summary>
        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {error.stack}
        </pre>
      </details>
    </div>
  );
};

// Connection Status Component
export const ConnectionStatus: React.FC = () => {
  const [connectionState, setConnectionState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    lastOnlineTime: null,
    connectionType: null,
    effectiveType: null
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = onConnectionChange(setConnectionState);
    return unsubscribe;
  }, []);

  if (connectionState.isOnline) {
    return null; // Don't show when online
  }

  return (
    <div className="connection-status fixed top-4 right-4 z-50">
      <div className="bg-red-100 border border-red-200 rounded-lg p-3 shadow-lg max-w-sm">
        <div className="flex items-start space-x-3">
          <WifiOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-900">You're offline</h4>
            <p className="text-sm text-red-800 mt-1">
              Your questions will be saved and sent when you're back online.
            </p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-red-700 hover:text-red-900 mt-2 underline"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            
            {showDetails && (
              <div className="mt-2 text-xs text-red-700">
                <div>Connection: {connectionState.connectionType || 'Unknown'}</div>
                <div>Speed: {connectionState.effectiveType || 'Unknown'}</div>
                {connectionState.lastOnlineTime && (
                  <div>Last online: {connectionState.lastOnlineTime.toLocaleTimeString()}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Queued Queries Display
export const QueuedQueriesStatus: React.FC = () => {
  const [queuedQueries, setQueuedQueries] = useState<CachedQuery[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateQueue = () => {
      const queries = getQueuedQueries();
      setQueuedQueries(queries);
      setIsVisible(queries.length > 0);
    };

    updateQueue();
    const interval = setInterval(updateQueue, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return null;
  }

  const pendingCount = queuedQueries.filter(q => q.status === 'pending').length;
  const retryingCount = queuedQueries.filter(q => q.status === 'retrying').length;
  const failedCount = queuedQueries.filter(q => q.status === 'failed').length;

  return (
    <div className="queued-queries-status bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">
          {queuedQueries.length} question{queuedQueries.length !== 1 ? 's' : ''} queued
        </span>
      </div>
      
      <div className="mt-2 text-xs text-blue-800">
        {pendingCount > 0 && <span>{pendingCount} pending</span>}
        {retryingCount > 0 && <span className="ml-2">{retryingCount} retrying</span>}
        {failedCount > 0 && <span className="ml-2 text-red-600">{failedCount} failed</span>}
      </div>
      
      <div className="mt-2">
        <button
          onClick={() => offlineManager.syncQueuedQueries()}
          className="text-xs text-blue-700 hover:text-blue-900 underline"
        >
          Retry now
        </button>
      </div>
    </div>
  );
};

// System Health Monitor
export const SystemHealthMonitor: React.FC<{ showDetails?: boolean }> = ({ 
  showDetails = false 
}) => {
  const [health, setHealth] = useState(getSystemHealth());
  const [cacheStats, setCacheStats] = useState(getCacheStats());

  useEffect(() => {
    const updateHealth = () => {
      setHealth(getSystemHealth());
      setCacheStats(getCacheStats());
    };

    updateHealth();
    const interval = setInterval(updateHealth, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (!showDetails && health.healthyPercentage === 100) {
    return null; // Don't show when everything is healthy
  }

  const getHealthIcon = () => {
    if (health.healthyPercentage === 100) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (health.healthyPercentage >= 50) {
      return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getHealthColor = () => {
    if (health.healthyPercentage === 100) {
      return 'bg-green-50 border-green-200 text-green-800';
    } else if (health.healthyPercentage >= 50) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    } else {
      return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  return (
    <div className={`system-health-monitor rounded-lg p-3 border ${getHealthColor()}`}>
      <div className="flex items-center space-x-2">
        {getHealthIcon()}
        <span className="text-sm font-medium">
          System Health: {health.healthyPercentage.toFixed(0)}%
        </span>
      </div>
      
      {showDetails && (
        <div className="mt-2 text-xs space-y-1">
          <div>Services: {health.healthy.length}/{health.total} healthy</div>
          <div>Cache: {cacheStats.totalEntries} entries ({(cacheStats.totalSize / 1024 / 1024).toFixed(1)} MB)</div>
          
          {health.unhealthy.length > 0 && (
            <div className="mt-2">
              <div className="font-medium">Unhealthy services:</div>
              <ul className="list-disc list-inside ml-2">
                {health.unhealthy.map(service => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Error History Component
export const ErrorHistory: React.FC<{ maxErrors?: number }> = ({ maxErrors = 10 }) => {
  const [errors, setErrors] = useState<SchoolCopilotError[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateErrors = () => {
      const history = getErrorHistory().slice(0, maxErrors);
      setErrors(history);
    };

    updateErrors();
    const interval = setInterval(updateErrors, 5000);

    return () => clearInterval(interval);
  }, [maxErrors]);

  if (errors.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'text-red-600';
      case ErrorSeverity.HIGH:
        return 'text-red-500';
      case ErrorSeverity.MEDIUM:
        return 'text-yellow-600';
      case ErrorSeverity.LOW:
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTypeIcon = (type: ErrorType) => {
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.OFFLINE:
        return <WifiOff className="w-3 h-3" />;
      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
        return <AlertCircle className="w-3 h-3" />;
      case ErrorType.SERVER:
        return <Zap className="w-3 h-3" />;
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  return (
    <div className="error-history">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
      >
        <Activity className="w-4 h-4" />
        <span>Recent Issues ({errors.length})</span>
      </button>
      
      {isVisible && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {errors.map((error) => (
            <div key={error.id} className="bg-gray-50 rounded p-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className={getSeverityColor(error.severity)}>
                  {getTypeIcon(error.type)}
                </span>
                <span className="font-medium">{error.type}</span>
                <span className="text-gray-500">
                  {new Date(error.context.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-1 text-gray-700">{error.userMessage}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Retry Button Component
export const RetryButton: React.FC<{
  onRetry: () => Promise<void>;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ onRetry, disabled = false, children = 'Retry' }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (isRetrying || disabled) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      leftIcon={isRetrying ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
    >
      {isRetrying ? 'Retrying...' : children}
    </Button>
  );
};

// Error Recovery Actions Component
export const ErrorRecoveryActions: React.FC<{
  error: SchoolCopilotError;
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ error, onRetry, onDismiss }) => {
  const actions = [];

  // Add retry action if error is retryable
  if (error.retryable && onRetry) {
    actions.push(
      <RetryButton key="retry" onRetry={async () => onRetry()}>
        Try Again
      </RetryButton>
    );
  }

  // Add refresh action for certain error types
  if ([ErrorType.CLIENT, ErrorType.UNKNOWN].includes(error.type)) {
    actions.push(
      <Button
        key="refresh"
        variant="outline"
        onClick={() => window.location.reload()}
        leftIcon={<RefreshCw className="w-4 h-4" />}
      >
        Refresh Page
      </Button>
    );
  }

  // Add dismiss action
  if (onDismiss) {
    actions.push(
      <Button
        key="dismiss"
        variant="ghost"
        onClick={onDismiss}
        leftIcon={<XCircle className="w-4 h-4" />}
      >
        Dismiss
      </Button>
    );
  }

  return (
    <div className="error-recovery-actions flex space-x-2 mt-4">
      {actions}
    </div>
  );
};

// Comprehensive Error Display Component
export const ErrorDisplay: React.FC<{
  error: SchoolCopilotError;
  showDetails?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ error, showDetails = false, onRetry, onDismiss }) => {
  const [detailsVisible, setDetailsVisible] = useState(showDetails);

  const getSeverityColor = () => {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 'bg-red-50 border-red-200 text-red-800';
      case ErrorSeverity.HIGH:
        return 'bg-red-50 border-red-200 text-red-800';
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case ErrorSeverity.LOW:
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={`error-display rounded-lg p-4 border ${getSeverityColor()}`}>
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium">{error.userMessage}</h4>
          
          {error.suggestedActions && error.suggestedActions.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Try these solutions:</p>
              <ul className="text-sm list-disc list-inside mt-1 space-y-1">
                {error.suggestedActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}
          
          <ErrorRecoveryActions
            error={error}
            onRetry={onRetry}
            onDismiss={onDismiss}
          />
          
          {error.technicalDetails && (
            <div className="mt-3">
              <button
                onClick={() => setDetailsVisible(!detailsVisible)}
                className="text-xs underline"
              >
                {detailsVisible ? 'Hide' : 'Show'} technical details
              </button>
              
              {detailsVisible && (
                <pre className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs overflow-auto">
                  {error.technicalDetails}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};