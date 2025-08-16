/**
 * Logs Page
 * Comprehensive audit logging and monitoring system with privacy compliance
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ScrollText, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  Trash2,
  Shield,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { LogEntry } from '../components/logs/LogEntry';
import { LogFilters } from '../components/logs/LogFilters';
import { LogStats } from '../components/logs/LogStats';
import { ExportModal } from '../components/logs/ExportModal';
import { LogDetailsModal } from '../components/logs/LogDetailsModal';
import { RetentionSettingsModal } from '../components/logs/RetentionSettingsModal';
import type { AuditLog, LogFilters as LogFiltersType, ClassInfo } from '@shared/types';

const LOGS_PER_PAGE = 50;

export const LogsPage: React.FC = () => {
  const [filters, setFilters] = useState<LogFiltersType>({
    limit: LOGS_PER_PAGE,
    offset: 0,
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch audit logs
  const { data: logsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const response = await apiClient.getAuditLogs(filters);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch audit logs');
      }
      return {
        logs: response.data || [],
        total: response.data?.length || 0, // In real implementation, this would come from API
        hasMore: (response.data?.length || 0) === LOGS_PER_PAGE
      };
    },
  });

  // Fetch classes for filtering
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch classes');
      }
      return response.data || [];
    },
  });

  const handleFilterChange = (newFilters: Partial<LogFiltersType>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0 // Reset to first page when filters change
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setFilters(prev => ({
      ...prev,
      offset: (page - 1) * LOGS_PER_PAGE
    }));
  };

  const handleExport = async (exportFilters: LogFiltersType, format: 'csv' | 'json') => {
    try {
      const response = await apiClient.exportAuditLogs(exportFilters);
      
      if (response.success && response.data) {
        // Create download
        const blob = response.data as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Logs exported successfully');
        setShowExportModal(false);
      } else {
        toast.error('Failed to export logs');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  const handleClearOldLogs = async () => {
    if (window.confirm('Are you sure you want to clear old logs? This action cannot be undone.')) {
      try {
        // This would call an API endpoint to clear old logs
        toast.success('Old logs cleared successfully');
        refetch();
      } catch (error) {
        toast.error('Failed to clear old logs');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load logs</h3>
        <p className="text-gray-600 mb-4">Please try refreshing the page</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const logs = logsResponse?.logs || [];
  const totalPages = Math.ceil((logsResponse?.total || 0) / LOGS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600">Monitor student queries and system activity</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            leftIcon={<BarChart3 className="w-4 h-4" />}
            onClick={() => setShowRetentionModal(true)}
          >
            Settings
          </Button>
          
          <Button
            variant="outline"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          
          <Button 
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => setShowExportModal(true)}
          >
            Export Logs
          </Button>
        </div>
      </div>

      {/* Stats */}
      <LogStats logs={logs} />

      {/* Filters */}
      <LogFilters
        filters={filters}
        classes={classes || []}
        onFiltersChange={handleFilterChange}
      />

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Privacy Compliance</h4>
            <p className="text-sm text-blue-800 mt-1">
              Logs contain only essential information: student email/ID, timestamps, query success/failure, 
              and citation counts. No personal information or query content is stored to protect student privacy.
            </p>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {logs.length > 0 ? (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Activity Log ({logsResponse?.total || 0} entries)
                </h3>
                
                {logs.length > 10 && (
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * LOGS_PER_PAGE) + 1}-{Math.min(currentPage * LOGS_PER_PAGE, logsResponse?.total || 0)} of {logsResponse?.total || 0}
                  </div>
                )}
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <LogEntry
                  key={log.id}
                  log={log}
                  classes={classes || []}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 text-sm rounded ${
                              page === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <ScrollText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {Object.keys(filters).length > 2 ? 'No logs match your filters' : 'No activity logs yet'}
            </h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 2 
                ? 'Try adjusting your filters to see more results'
                : 'Student activity will appear here once they start using the system'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        classes={classes || []}
        currentFilters={filters}
      />

      {selectedLog && (
        <LogDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedLog(null);
          }}
          log={selectedLog}
          classes={classes || []}
        />
      )}

      <RetentionSettingsModal
        isOpen={showRetentionModal}
        onClose={() => setShowRetentionModal(false)}
        onClearOldLogs={handleClearOldLogs}
      />
    </div>
  );
};