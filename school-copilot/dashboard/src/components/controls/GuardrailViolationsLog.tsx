/**
 * Guardrail Violations Log Component
 * Displays and manages content moderation violations
 */

import React, { useState } from 'react';
import { 
  Eye, 
  AlertTriangle, 
  Clock, 
  User, 
  MessageSquare,
  Filter,
  Search,
  Download,
  RefreshCw,
  Shield,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface GuardrailViolation {
  id: string;
  timestamp: string;
  studentId: string;
  studentName?: string;
  classId?: string;
  className?: string;
  violationType: 'blocked_term' | 'daily_limit' | 'inappropriate_content' | 'system_bypass';
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockedQuery: string;
  matchedTerms?: string[];
  action: 'blocked' | 'flagged' | 'escalated';
  teacherNotified: boolean;
  resolved: boolean;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface GuardrailViolationsLogProps {
  violations: GuardrailViolation[];
  isLoading: boolean;
  classId?: string;
}

const VIOLATION_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'blocked_term', label: 'Blocked Terms' },
  { value: 'daily_limit', label: 'Daily Limit Exceeded' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'system_bypass', label: 'System Bypass Attempt' },
];

const SEVERITY_LEVELS = [
  { value: 'all', label: 'All Severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'low':
      return 'bg-blue-100 text-blue-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'critical':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getViolationTypeIcon = (type: string) => {
  switch (type) {
    case 'blocked_term':
      return <AlertTriangle className="w-4 h-4" />;
    case 'daily_limit':
      return <Clock className="w-4 h-4" />;
    case 'inappropriate_content':
      return <Shield className="w-4 h-4" />;
    case 'system_bypass':
      return <MessageSquare className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
};

const getViolationTypeLabel = (type: string) => {
  switch (type) {
    case 'blocked_term':
      return 'Blocked Term';
    case 'daily_limit':
      return 'Daily Limit';
    case 'inappropriate_content':
      return 'Inappropriate Content';
    case 'system_bypass':
      return 'System Bypass';
    default:
      return 'Unknown';
  }
};

export const GuardrailViolationsLog: React.FC<GuardrailViolationsLogProps> = ({
  violations,
  isLoading,
  classId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [violationTypeFilter, setViolationTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());
  const [selectedViolation, setSelectedViolation] = useState<GuardrailViolation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filter violations
  const filteredViolations = violations.filter(violation => {
    const matchesSearch = 
      violation.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.blockedQuery.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.matchedTerms?.some(term => term.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = violationTypeFilter === 'all' || violation.violationType === violationTypeFilter;
    const matchesSeverity = severityFilter === 'all' || violation.severity === severityFilter;
    const matchesResolved = resolvedFilter === 'all' || 
      (resolvedFilter === 'resolved' && violation.resolved) ||
      (resolvedFilter === 'unresolved' && !violation.resolved);

    return matchesSearch && matchesType && matchesSeverity && matchesResolved;
  });

  const toggleViolationExpansion = (violationId: string) => {
    setExpandedViolations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(violationId)) {
        newSet.delete(violationId);
      } else {
        newSet.add(violationId);
      }
      return newSet;
    });
  };

  const handleViewDetails = (violation: GuardrailViolation) => {
    setSelectedViolation(violation);
    setShowDetailsModal(true);
  };

  const handleExportViolations = () => {
    const csvContent = [
      ['Timestamp', 'Student', 'Class', 'Type', 'Severity', 'Query', 'Matched Terms', 'Action', 'Resolved'].join(','),
      ...filteredViolations.map(v => [
        v.timestamp,
        v.studentName || v.studentId,
        v.className || v.classId || '',
        getViolationTypeLabel(v.violationType),
        v.severity,
        `"${v.blockedQuery.replace(/"/g, '""')}"`,
        `"${(v.matchedTerms || []).join(', ')}"`,
        v.action,
        v.resolved ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guardrail-violations-${classId || 'global'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Violations exported to CSV');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search violations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Violation Type Filter */}
          <select
            value={violationTypeFilter}
            onChange={(e) => setViolationTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {VIOLATION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {SEVERITY_LEVELS.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>

          {/* Resolved Filter */}
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>

          {/* Export Button */}
          <Button
            variant="outline"
            onClick={handleExportViolations}
            leftIcon={<Download className="w-4 h-4" />}
            disabled={filteredViolations.length === 0}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Violations</p>
              <p className="text-2xl font-bold text-gray-900">{filteredViolations.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unresolved</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredViolations.filter(v => !v.resolved).length}
              </p>
            </div>
            <X className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High/Critical</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredViolations.filter(v => v.severity === 'high' || v.severity === 'critical').length}
              </p>
            </div>
            <Shield className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredViolations.filter(v => 
                  new Date(v.timestamp).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Violations List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Violations Log ({filteredViolations.length})
            </h3>
            {isLoading && <LoadingSpinner size="sm" />}
          </div>
        </div>

        {filteredViolations.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredViolations.map((violation) => (
              <div key={violation.id} className="hover:bg-gray-50 transition-colors">
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {/* Type Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getViolationTypeIcon(violation.violationType)}
                      </div>
                      
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                            {violation.severity.toUpperCase()}
                          </span>
                          
                          <span className="text-sm font-medium text-gray-900">
                            {getViolationTypeLabel(violation.violationType)}
                          </span>
                          
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(violation.timestamp)}
                          </span>
                          
                          {!violation.resolved && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Unresolved
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>Student: {violation.studentName || violation.studentId}</span>
                          </div>
                          {violation.className && (
                            <span>Class: {violation.className}</span>
                          )}
                        </div>
                        
                        <div className="bg-gray-100 rounded p-2 mb-2">
                          <p className="text-sm text-gray-800 font-mono">
                            "{violation.blockedQuery}"
                          </p>
                        </div>
                        
                        {violation.matchedTerms && violation.matchedTerms.length > 0 && (
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs text-gray-500">Matched terms:</span>
                            <div className="flex flex-wrap gap-1">
                              {violation.matchedTerms.map((term, index) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                                  {term}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {expandedViolations.has(violation.id) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-medium text-gray-700">Action Taken:</span>
                                <span className="ml-2 capitalize">{violation.action}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Teacher Notified:</span>
                                <span className="ml-2">{violation.teacherNotified ? 'Yes' : 'No'}</span>
                              </div>
                              {violation.ipAddress && (
                                <div>
                                  <span className="font-medium text-gray-700">IP Address:</span>
                                  <span className="ml-2 font-mono">{violation.ipAddress}</span>
                                </div>
                              )}
                              {violation.notes && (
                                <div className="col-span-2">
                                  <span className="font-medium text-gray-700">Notes:</span>
                                  <p className="mt-1 text-gray-600">{violation.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex-shrink-0 ml-4 space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleViolationExpansion(violation.id)}
                        leftIcon={expandedViolations.has(violation.id) ? 
                          <ChevronDown className="w-3 h-3" /> : 
                          <ChevronRight className="w-3 h-3" />
                        }
                      >
                        {expandedViolations.has(violation.id) ? 'Less' : 'More'}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(violation)}
                        leftIcon={<Eye className="w-3 h-3" />}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Shield className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {violations.length === 0 ? 'No violations recorded' : 'No violations match your filters'}
            </h3>
            <p className="text-sm text-gray-500">
              {violations.length === 0 
                ? 'Content filtering is working well - no inappropriate content detected'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedViolation && showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Violation Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="mt-1 text-sm text-gray-900">{getViolationTypeLabel(selectedViolation.violationType)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(selectedViolation.severity)}`}>
                      {selectedViolation.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Blocked Query</label>
                  <div className="mt-1 p-3 bg-gray-100 rounded font-mono text-sm">
                    {selectedViolation.blockedQuery}
                  </div>
                </div>
                
                {selectedViolation.matchedTerms && selectedViolation.matchedTerms.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Matched Terms</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {selectedViolation.matchedTerms.map((term, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Student</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedViolation.studentName || selectedViolation.studentId}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(selectedViolation.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                
                {selectedViolation.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedViolation.notes}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};