/**
 * Loading States Components
 * Enhanced loading indicators and transition states
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'currentColor',
  className = '',
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 
        className={`${sizeClasses[size]} animate-spin`}
        style={{ color }}
        aria-hidden="true"
      />
      {text && (
        <span className="ml-2 text-sm text-gray-600" aria-live="polite">
          {text}
        </span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface TypingIndicatorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className = '',
  size = 'md'
}) => {
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  return (
    <div className={`typing-indicator ${className}`} aria-label="AI is typing">
      <div className="flex items-center space-x-1">
        <div className={`typing-dot ${dotSizes[size]} bg-gray-400 rounded-full`} />
        <div className={`typing-dot ${dotSizes[size]} bg-gray-400 rounded-full`} />
        <div className={`typing-dot ${dotSizes[size]} bg-gray-400 rounded-full`} />
      </div>
      <span className="sr-only">AI is typing a response</span>
    </div>
  );
};

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  color?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = '',
  showPercentage = false,
  color = '#3b82f6',
  animated = true
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`progress-bar-container ${className}`}>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${animated ? 'animate-pulse' : ''}`}
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: color,
            backgroundImage: animated ? 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)' : undefined,
            backgroundSize: animated ? '1rem 1rem' : undefined,
            animation: animated ? 'progress-stripes 1s linear infinite' : undefined
          }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${clampedProgress}%`}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-gray-600 mt-1 block text-center">
          {clampedProgress}%
        </span>
      )}
    </div>
  );
};

interface ConnectionStatusProps {
  isOnline: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isOnline,
  className = ''
}) => {
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Show status briefly when connection changes
    setShowStatus(true);
    const timer = setTimeout(() => setShowStatus(false), 3000);
    return () => clearTimeout(timer);
  }, [isOnline]);

  if (!showStatus) return null;

  return (
    <div className={`connection-status ${className}`}>
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        isOnline 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" aria-hidden="true" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" aria-hidden="true" />
            <span>Offline</span>
          </>
        )}
      </div>
    </div>
  );
};

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
  className = ''
}) => {
  if (!isVisible) return null;

  return (
    <div className={`loading-overlay ${className}`}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <p className="text-gray-700 mb-4">{message}</p>
            {progress !== undefined && (
              <ProgressBar progress={progress} showPercentage animated />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatusIndicatorProps {
  status: 'loading' | 'success' | 'error' | 'idle';
  message?: string;
  className?: string;
  autoHide?: boolean;
  duration?: number;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  className = '',
  autoHide = false,
  duration = 3000
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide && (status === 'success' || status === 'error')) {
      const timer = setTimeout(() => setIsVisible(false), duration);
      return () => clearTimeout(timer);
    }
  }, [status, autoHide, duration]);

  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          icon: <LoadingSpinner size="sm" />,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200'
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: null,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`status-indicator ${className}`}>
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor} transition-all duration-300`}>
        {config.icon}
        {message && <span className="text-sm font-medium">{message}</span>}
      </div>
    </div>
  );
};

interface PulseLoaderProps {
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({
  count = 3,
  size = 'md',
  color = '#3b82f6',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <div className={`pulse-loader flex items-center space-x-1 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`${sizeClasses[size]} rounded-full animate-pulse`}
          style={{
            backgroundColor: color,
            animationDelay: `${index * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
};

interface WaveLoaderProps {
  className?: string;
  color?: string;
}

export const WaveLoader: React.FC<WaveLoaderProps> = ({
  className = '',
  color = '#3b82f6'
}) => {
  return (
    <div className={`wave-loader flex items-end space-x-1 ${className}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="w-1 bg-current rounded-full animate-pulse"
          style={{
            height: `${12 + (index % 3) * 4}px`,
            backgroundColor: color,
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.8s'
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
};

interface BouncingDotsProps {
  className?: string;
  color?: string;
}

export const BouncingDots: React.FC<BouncingDotsProps> = ({
  className = '',
  color = '#3b82f6'
}) => {
  return (
    <div className={`bouncing-dots flex items-center space-x-1 ${className}`}>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: color,
            animation: `bounce 1.4s ease-in-out ${index * 0.16}s infinite both`
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
};

// Custom CSS for animations (to be added to the main CSS file)
export const LoadingAnimationStyles = `
@keyframes progress-stripes {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 1rem 0;
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.pulse-loader > div {
  animation: pulse 1s ease-in-out infinite;
}

.wave-loader > div {
  animation: wave 0.8s ease-in-out infinite;
}

@keyframes wave {
  0%, 40%, 100% {
    transform: scaleY(0.4);
  }
  20% {
    transform: scaleY(1);
  }
}

.loading-overlay {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.status-indicator {
  animation: slideInFromTop 0.3s ease-out;
}

@keyframes slideInFromTop {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.connection-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  animation: slideInFromRight 0.3s ease-out;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
`;