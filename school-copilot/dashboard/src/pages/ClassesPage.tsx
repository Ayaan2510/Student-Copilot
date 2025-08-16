/**
 * Classes Management Page
 * Complete class management interface with student roster and access controls
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Plus, 
  Settings, 
  Upload, 
  Download,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ClassCard } from '../components/classes/ClassCard';
import { CreateClassModal } from '../components/classes/CreateClassModal';
import { StudentRosterModal } from '../components/classes/StudentRosterModal';
import { ImportStudentsModal } from '../components/classes/ImportStudentsModal';
import { ClassSettingsModal } from '../components/classes/ClassSettingsModal';
import type { ClassInfo } from '@shared/types';

export const ClassesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  const queryClient = useQueryClient();

  // Fetch classes
  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch classes');
      }
      return response.data || [];
    },
  });

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (classData: Partial<ClassInfo>) => {
      const response = await apiClient.createClass(classData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create class');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class created successfully');
      setShowCreateModal(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async ({ classId, data }: { classId: string; data: Partial<ClassInfo> }) => {
      const response = await apiClient.updateClass(classId, data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update class');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      const response = await apiClient.deleteClass(classId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete class');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Set class access mutation
  const setAccessMutation = useMutation({
    mutationFn: async (accessData: any) => {
      const response = await apiClient.setClassAccess(accessData);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update access');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Access updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter classes based on search and status
  const filteredClasses = classes?.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'enabled' && cls.enabled) ||
      (filterStatus === 'disabled' && !cls.enabled);
    
    return matchesSearch && matchesFilter;
  }) || [];

  const handleCreateClass = (classData: Partial<ClassInfo>) => {
    createClassMutation.mutate(classData);
  };

  const handleUpdateClass = (classId: string, data: Partial<ClassInfo>) => {
    updateClassMutation.mutate({ classId, data });
  };

  const handleDeleteClass = (classId: string) => {
    if (window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      deleteClassMutation.mutate(classId);
    }
  };

  const handleToggleClassAccess = (classId: string, enabled: boolean) => {
    setAccessMutation.mutate({
      classId,
      enabled,
      action: enabled ? 'enable_class' : 'disable_class'
    });
  };

  const handleViewRoster = (cls: ClassInfo) => {
    setSelectedClass(cls);
    setShowRosterModal(true);
  };

  const handleImportStudents = (cls: ClassInfo) => {
    setSelectedClass(cls);
    setShowImportModal(true);
  };

  const handleClassSettings = (cls: ClassInfo) => {
    setSelectedClass(cls);
    setShowSettingsModal(true);
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load classes</h3>
        <p className="text-gray-600">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-600">Manage your classes and student access</p>
        </div>
        <Button 
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Add Class
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{classes?.length || 0}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Classes</p>
              <p className="text-3xl font-bold text-gray-900">
                {classes?.filter(c => c.enabled).length || 0}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900">
                {classes?.reduce((sum, c) => sum + (c.studentCount || 0), 0) || 0}
              </p>
            </div>
            <UserCheck className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Documents</p>
              <p className="text-3xl font-bold text-gray-900">
                {classes?.reduce((sum, c) => sum + (c.documentCount || 0), 0) || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Classes</option>
              <option value="enabled">Active Only</option>
              <option value="disabled">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      {filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((cls) => (
            <ClassCard
              key={cls.id}
              classInfo={cls}
              onToggleAccess={handleToggleClassAccess}
              onViewRoster={handleViewRoster}
              onImportStudents={handleImportStudents}
              onSettings={handleClassSettings}
              onEdit={(cls) => {
                setSelectedClass(cls);
                setShowCreateModal(true);
              }}
              onDelete={handleDeleteClass}
              isUpdating={updateClassMutation.isPending || setAccessMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterStatus !== 'all' ? 'No classes found' : 'No classes yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Create your first class to get started'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <Button 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Create Class
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedClass(null);
        }}
        onSubmit={handleCreateClass}
        editingClass={selectedClass}
        isLoading={createClassMutation.isPending || updateClassMutation.isPending}
      />

      {selectedClass && (
        <>
          <StudentRosterModal
            isOpen={showRosterModal}
            onClose={() => {
              setShowRosterModal(false);
              setSelectedClass(null);
            }}
            classInfo={selectedClass}
            onUpdateAccess={(studentId, enabled) => {
              setAccessMutation.mutate({
                classId: selectedClass.id,
                studentId,
                enabled,
                action: enabled ? 'enable_student' : 'disable_student'
              });
            }}
          />

          <ImportStudentsModal
            isOpen={showImportModal}
            onClose={() => {
              setShowImportModal(false);
              setSelectedClass(null);
            }}
            classInfo={selectedClass}
            onImport={(csvData) => {
              // Handle CSV import
              apiClient.importStudents(selectedClass.id, csvData)
                .then((response) => {
                  if (response.success) {
                    toast.success('Students imported successfully');
                    queryClient.invalidateQueries({ queryKey: ['classes'] });
                    setShowImportModal(false);
                  } else {
                    toast.error(response.error || 'Import failed');
                  }
                })
                .catch((error) => {
                  toast.error('Import failed');
                });
            }}
          />

          <ClassSettingsModal
            isOpen={showSettingsModal}
            onClose={() => {
              setShowSettingsModal(false);
              setSelectedClass(null);
            }}
            classInfo={selectedClass}
            onUpdate={(data) => handleUpdateClass(selectedClass.id, data)}
            isLoading={updateClassMutation.isPending}
          />
        </>
      )}
    </div>
  );
};