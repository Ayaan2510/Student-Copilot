/**
 * Skeleton Loader Components
 * Provides loading states with skeleton screens for better UX
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  borderRadius = '0.375rem',
  animate = true
}) => {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div
      className={`${animate ? 'loading-skeleton' : 'bg-gray-200'} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export const MessageSkeleton: React.FC = () => {
  return (
    <div className="chat-message assistant-message" aria-hidden="true">
      <div className="message-content">
        <div className="message-header mb-2">
          <Skeleton width={80} height={16} />
        </div>
        <div className="message-body space-y-2">
          <Skeleton width="100%" height={16} />
          <Skeleton width="85%" height={16} />
          <Skeleton width="92%" height={16} />
          <Skeleton width="78%" height={16} />
        </div>
        <div className="message-footer mt-3">
          <div className="flex space-x-2">
            <Skeleton width={60} height={24} borderRadius={12} />
            <Skeleton width={80} height={24} borderRadius={12} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ClassSelectorSkeleton: React.FC = () => {
  return (
    <div className="class-selector" aria-hidden="true">
      <Skeleton width={120} height={36} borderRadius={8} />
    </div>
  );
};

export const QuickActionsSkeleton: React.FC = () => {
  return (
    <div className="quick-actions" aria-hidden="true">
      <Skeleton width={80} height={32} borderRadius={16} />
      <Skeleton width={70} height={32} borderRadius={16} />
      <Skeleton width={90} height={32} borderRadius={16} />
    </div>
  );
};

export const ChatHistorySkeleton: React.FC = () => {
  return (
    <div className="messages-area" aria-hidden="true">
      <div className="space-y-4">
        {/* User message skeleton */}
        <div className="chat-message user-message">
          <div className="message-content">
            <Skeleton width="75%" height={16} />
            <Skeleton width="60%" height={16} className="mt-1" />
          </div>
        </div>

        {/* Assistant message skeleton */}
        <MessageSkeleton />

        {/* Another user message */}
        <div className="chat-message user-message">
          <div className="message-content">
            <Skeleton width="80%" height={16} />
          </div>
        </div>

        {/* Another assistant message */}
        <MessageSkeleton />
      </div>
    </div>
  );
};

export const HeaderSkeleton: React.FC = () => {
  return (
    <div className="sidepanel-header" aria-hidden="true">
      <div className="header-title">
        <div className="flex items-center space-x-3">
          <Skeleton width={40} height={40} borderRadius="50%" />
          <Skeleton width={140} height={24} />
        </div>
      </div>
      <ClassSelectorSkeleton />
    </div>
  );
};

export const FullPageSkeleton: React.FC = () => {
  return (
    <div className="sidepanel-container" aria-hidden="true">
      <HeaderSkeleton />
      <div className="chat-container">
        <ChatHistorySkeleton />
      </div>
      <div className="input-area">
        <QuickActionsSkeleton />
        <div className="input-field">
          <Skeleton width="100%" height={44} borderRadius={8} />
        </div>
      </div>
    </div>
  );
};

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ 
  lines = 3, 
  className = '' 
}) => {
  const lineWidths = ['100%', '85%', '92%', '78%', '95%', '88%'];
  
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          width={lineWidths[index % lineWidths.length]}
          height={16}
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = '',
  showHeader = true,
  showFooter = false,
  lines = 3
}) => {
  return (
    <div className={`p-4 border border-gray-200 rounded-lg ${className}`} aria-hidden="true">
      {showHeader && (
        <div className="mb-3">
          <Skeleton width="60%" height={20} />
        </div>
      )}
      
      <SkeletonText lines={lines} />
      
      {showFooter && (
        <div className="mt-4 flex space-x-2">
          <Skeleton width={80} height={32} borderRadius={16} />
          <Skeleton width={60} height={32} borderRadius={16} />
        </div>
      )}
    </div>
  );
};

interface SkeletonListProps {
  items?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ 
  items = 5, 
  className = '' 
}) => {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex items-center space-x-3">
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div className="flex-1 space-y-2">
            <Skeleton width="75%" height={16} />
            <Skeleton width="50%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
};

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={`header-${index}`} width="80%" height={20} />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div 
          key={`row-${rowIndex}`} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} width="90%" height={16} />
          ))}
        </div>
      ))}
    </div>
  );
};

// Skeleton for specific components
export const CitationSkeleton: React.FC = () => {
  return (
    <div className="citation-panel" aria-hidden="true">
      <div className="citation-header mb-3">
        <Skeleton width={100} height={18} />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="citation-item p-2 border border-gray-200 rounded">
            <div className="flex items-start space-x-2">
              <Skeleton width={16} height={16} borderRadius="50%" />
              <div className="flex-1 space-y-1">
                <Skeleton width="80%" height={14} />
                <Skeleton width="60%" height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ErrorStateSkeleton: React.FC = () => {
  return (
    <div className="error-state p-6 text-center" aria-hidden="true">
      <Skeleton width={60} height={60} borderRadius="50%" className="mx-auto mb-4" />
      <Skeleton width="60%" height={20} className="mx-auto mb-2" />
      <Skeleton width="80%" height={16} className="mx-auto mb-4" />
      <Skeleton width={120} height={36} borderRadius={8} className="mx-auto" />
    </div>
  );
};

// Pulse animation variant
export const PulseSkeleton: React.FC<SkeletonProps> = (props) => {
  return <Skeleton {...props} className={`${props.className || ''} animate-pulse`} animate={false} />;
};

// Wave animation variant (for when we want a different animation)
export const WaveSkeleton: React.FC<SkeletonProps> = (props) => {
  return <Skeleton {...props} className={`${props.className || ''} loading-skeleton`} />;
};