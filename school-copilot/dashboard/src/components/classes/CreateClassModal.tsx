/**
 * Create/Edit Class Modal Component
 * Form for creating new classes or editing existing ones
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ClassInfo } from '@shared/types';

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(100, 'Class name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  enabled: z.boolean().default(true),
});

type ClassFormData = z.infer<typeof classSchema>;

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ClassInfo>) => void;
  editingClass?: ClassInfo | null;
  isLoading?: boolean;
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingClass,
  isLoading = false
}) => {
  const isEditing = !!editingClass;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      description: '',
      enabled: true,
    }
  });

  // Reset form when modal opens/closes or editing class changes
  useEffect(() => {
    if (isOpen) {
      if (editingClass) {
        reset({
          name: editingClass.name,
          description: editingClass.description || '',
          enabled: editingClass.enabled,
        });
      } else {
        reset({
          name: '',
          description: '',
          enabled: true,
        });
      }
    }
  }, [isOpen, editingClass, reset]);

  const handleFormSubmit = (data: ClassFormData) => {
    const classData: Partial<ClassInfo> = {
      name: data.name,
      description: data.description,
      enabled: data.enabled,
    };

    if (isEditing) {
      classData.id = editingClass.id;
    }

    onSubmit(classData);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit Class' : 'Create New Class'}
                </h3>
                <p className="text-sm text-gray-600">
                  {isEditing ? 'Update class information' : 'Add a new class to your dashboard'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-500 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Class Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Class Name *
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                placeholder="e.g., Introduction to Computer Science"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={3}
                placeholder="Optional description of the class..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                disabled={isLoading}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center space-x-3">
              <input
                {...register('enabled')}
                type="checkbox"
                id="enabled"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                Enable class immediately
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isLoading}
                disabled={!isValid || isLoading}
              >
                {isEditing ? 'Update Class' : 'Create Class'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};