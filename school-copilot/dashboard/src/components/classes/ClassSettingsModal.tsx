/**
 * Class Settings Modal Component
 * Advanced settings and configuration for classes
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Settings, Shield, Clock, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ClassInfo } from '@shared/types';

const settingsSchema = z.object({
  dailyQuestionLimit: z.number().min(1, 'Must be at least 1').max(100, 'Cannot exceed 100'),
  blockedTerms: z.string(),
  allowAnonymousQuestions: z.boolean(),
  requireApproval: z.boolean(),
  enableLogging: z.boolean(),
  description: z.string().max(500, 'Description too long').optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ClassSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo;
  onUpdate: (data: Partial<ClassInfo>) => void;
  isLoading?: boolean;
}

export const ClassSettingsModal: React.FC<ClassSettingsModalProps> = ({
  isOpen,
  onClose,
  classInfo,
  onUpdate,
  isLoading = false
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      dailyQuestionLimit: 20,
      blockedTerms: '',
      allowAnonymousQuestions: false,
      requireApproval: false,
      enableLogging: true,
      description: '',
    }
  });

  // Reset form when modal opens or class changes
  useEffect(() => {
    if (isOpen && classInfo) {
      reset({
        dailyQuestionLimit: (classInfo as any).dailyQuestionLimit || 20,
        blockedTerms: (classInfo as any).blockedTerms?.join(', ') || '',
        allowAnonymousQuestions: (classInfo as any).allowAnonymousQuestions || false,
        requireApproval: (classInfo as any).requireApproval || false,
        enableLogging: (classInfo as any).enableLogging !== false,
        description: classInfo.description || '',
      });
    }
  }, [isOpen, classInfo, reset]);

  const handleFormSubmit = (data: SettingsFormData) => {
    const updateData: Partial<ClassInfo> = {
      description: data.description,
      // Additional settings would be included here
      ...(data as any), // Type assertion for additional fields
      blockedTerms: data.blockedTerms
        .split(',')
        .map(term => term.trim())
        .filter(term => term.length > 0),
    };

    onUpdate(updateData);
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
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Class Settings - {classInfo.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Configure advanced options and policies
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
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Settings className="w-5 h-5 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Basic Settings</h4>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Class Description
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
            </div>

            {/* Usage Limits */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="w-5 h-5 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Usage Limits</h4>
              </div>

              {/* Daily Question Limit */}
              <div>
                <label htmlFor="dailyQuestionLimit" className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Question Limit per Student
                </label>
                <input
                  {...register('dailyQuestionLimit', { valueAsNumber: true })}
                  type="number"
                  id="dailyQuestionLimit"
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
                {errors.dailyQuestionLimit && (
                  <p className="mt-1 text-sm text-red-600">{errors.dailyQuestionLimit.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of questions each student can ask per day
                </p>
              </div>
            </div>

            {/* Content Filtering */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Filter className="w-5 h-5 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Content Filtering</h4>
              </div>

              {/* Blocked Terms */}
              <div>
                <label htmlFor="blockedTerms" className="block text-sm font-medium text-gray-700 mb-1">
                  Blocked Terms
                </label>
                <textarea
                  {...register('blockedTerms')}
                  id="blockedTerms"
                  rows={3}
                  placeholder="Enter blocked terms separated by commas..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={isLoading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Questions containing these terms will be blocked. Separate multiple terms with commas.
                </p>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="w-5 h-5 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Privacy & Security</h4>
              </div>

              <div className="space-y-3">
                {/* Allow Anonymous Questions */}
                <div className="flex items-center space-x-3">
                  <input
                    {...register('allowAnonymousQuestions')}
                    type="checkbox"
                    id="allowAnonymousQuestions"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <label htmlFor="allowAnonymousQuestions" className="text-sm font-medium text-gray-700">
                    Allow anonymous questions
                  </label>
                </div>

                {/* Require Approval */}
                <div className="flex items-center space-x-3">
                  <input
                    {...register('requireApproval')}
                    type="checkbox"
                    id="requireApproval"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <label htmlFor="requireApproval" className="text-sm font-medium text-gray-700">
                    Require teacher approval for questions
                  </label>
                </div>

                {/* Enable Logging */}
                <div className="flex items-center space-x-3">
                  <input
                    {...register('enableLogging')}
                    type="checkbox"
                    id="enableLogging"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <label htmlFor="enableLogging" className="text-sm font-medium text-gray-700">
                    Enable activity logging
                  </label>
                </div>
              </div>
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
                disabled={!isDirty || isLoading}
              >
                Save Settings
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};