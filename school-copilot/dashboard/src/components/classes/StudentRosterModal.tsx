/**
 * Student Roster Modal Component
 * Displays and manages student list with individual access controls
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Users, 
  Search, 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { ClassInfo } from '@shared/types';

interface Student {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  lastActivity?: Date;
  queryCount?: number;
}

interface StudentRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo;
  onUpdateAccess: (studentId: string, enabled: boolean) => void;
}

export const StudentRosterModal: React.FC<StudentRosterModalProps> = ({
  isOpen,
  onClose,
  classInfo,
  onUpdateAccess
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Fetch students for this class
  const { data: students, isLoading, error, refetch } = useQuery({
    queryKey: ['class-students', classInfo.id],
    queryFn: async () => {
      const response = await apiClient.getClassStudents(classInfo.id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch students');
      }
      return response.data || [];
    },
    enabled: isOpen,
  });

  // Filter students based on search and status
  const filteredStudents = students?.filter((student: Student) => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'enabled' && student.enabled) ||
      (filterStatus === 'disabled' && !student.enabled);
    
    return matchesSearch && matchesFilter;
  }) || [];

  const handleToggleAccess = (student: Student) => {
    onUpdateAccess(student.id, !student.enabled);
  };

  const handleBulkToggle = (enabled: boolean) => {
    const studentsToUpdate = filteredStudents.filter(s => s.enabled !== enabled);
    
    if (studentsToUpdate.length === 0) {
      toast.info(`All students are already ${enabled ? 'enabled' : 'disabled'}`);
      return;
    }

    const action = enabled ? 'enable' : 'disable';
    const confirmMessage = `Are you sure you want to ${action} ${studentsToUpdate.length} student(s)?`;
    
    if (window.confirm(confirmMessage)) {
      studentsToUpdate.forEach(student => {
        onUpdateAccess(student.id, enabled);
      });
    }
  };

  const handleExportRoster = () => {
    if (!students || students.length === 0) {
      toast.error('No students to export');
      return;
    }

    const csvContent = [
      ['Name', 'Email', 'Status', 'Last Activity', 'Query Count'].join(','),
      ...students.map((student: Student) => [
        student.name,
        student.email,
        student.enabled ? 'Enabled' : 'Disabled',
        student.lastActivity ? new Date(student.lastActivity).toLocaleDateString() : 'Never',
        student.queryCount || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${classInfo.name}-roster.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('Roster exported successfully');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Student Roster - {classInfo.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Manage individual student access and permissions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Students</option>
                <option value="enabled">Enabled Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRoster}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {filteredStudents.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
              <span className="text-sm text-gray-600">
                {filteredStudents.length} student(s) shown
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggle(true)}
                  leftIcon={<UserCheck className="w-4 h-4" />}
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggle(false)}
                  leftIcon={<UserX className="w-4 h-4" />}
                >
                  Disable All
                </Button>
              </div>
            </div>
          )}

          {/* Student List */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-2">Failed to load students</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-600">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No students match your filters' 
                    : 'No students in this class yet'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredStudents.map((student: Student) => (
                  <div key={student.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {student.name}
                          </h4>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span>{student.email}</span>
                            </div>
                            {student.lastActivity && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>Last active: {new Date(student.lastActivity).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* Query Count */}
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {student.queryCount || 0}
                          </div>
                          <div className="text-xs text-gray-500">queries</div>
                        </div>

                        {/* Status Badge */}
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                          student.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {student.enabled ? (
                            <UserCheck className="w-3 h-3" />
                          ) : (
                            <UserX className="w-3 h-3" />
                          )}
                          <span>{student.enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>

                        {/* Toggle Button */}
                        <Button
                          variant={student.enabled ? "danger" : "primary"}
                          size="sm"
                          onClick={() => handleToggleAccess(student)}
                        >
                          {student.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-200 mt-6">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};