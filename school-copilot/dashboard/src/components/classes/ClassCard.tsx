/**
 * Class Card Component
 * Displays individual class information with action buttons
 */

import React, { useState } from 'react';
import { 
  Users, 
  FileText, 
  Settings, 
  Upload, 
  Edit, 
  Trash2, 
  MoreVertical,
  CheckCircle,
  XCircle,
  Calendar,
  UserCheck,
  UserX
} from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { ClassInfo } from '@shared/types';

interface ClassCardProps {
  classInfo: ClassInfo;
  onToggleAccess: (classId: string, enabled: boolean) => void;
  onViewRoster: (classInfo: ClassInfo) => void;
  onImportStudents: (classInfo: ClassInfo) => void;
  onSettings: (classInfo: ClassInfo) => void;
  onEdit: (classInfo: ClassInfo) => void;
  onDelete: (classId: string) => void;
  isUpdating?: boolean;
}

export const ClassCard: React.FC<ClassCardProps> = ({
  classInfo,
  onToggleAccess,
  onViewRoster,
  onImportStudents,
  onSettings,
  onEdit,
  onDelete,
  isUpdating = false
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleToggleAccess = () => {
    onToggleAccess(classInfo.id, !classInfo.enabled);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {classInfo.name}
              </h3>
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                classInfo.enabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {classInfo.enabled ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>{classInfo.enabled ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            
            <div className="flex items-center text-sm text-gray-500 space-x-4">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Created {new Date(classInfo.createdDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <LoadingSpinner size="sm" />
              ) : (
                <MoreVertical className="w-5 h-5" />
              )}
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onEdit(classInfo);
                      setShowMenu(false);
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Class
                  </button>
                  
                  <button
                    onClick={() => {
                      onSettings(classInfo);
                      setShowMenu(false);
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </button>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                  
                  <button
                    onClick={() => {
                      onDelete(classInfo.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Class
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">
                {classInfo.studentCount || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">Students</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">
                {classInfo.documentCount || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">Documents</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-3">
        {/* Toggle Access */}
        <Button
          variant={classInfo.enabled ? "danger" : "primary"}
          size="sm"
          className="w-full"
          onClick={handleToggleAccess}
          disabled={isUpdating}
          leftIcon={classInfo.enabled ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
        >
          {classInfo.enabled ? 'Disable Class' : 'Enable Class'}
        </Button>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewRoster(classInfo)}
            leftIcon={<Users className="w-4 h-4" />}
          >
            View Roster
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onImportStudents(classInfo)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Import CSV
          </Button>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};