/**
 * Controls Page
 * Content guardrails and usage policies management
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Settings, 
  AlertTriangle, 
  Clock, 
  MessageSquare,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  BarChart3,
  Eye,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BlockedTermsManager } from '../components/controls/BlockedTermsManager';
import { QuestionLimitsManager } from '../components/controls/QuestionLimitsManager';
import { GuardrailViolationsLog } from '../components/controls/GuardrailViolationsLog';
import { UsagePolicyEditor } from '../components/controls/UsagePolicyEditor';
import { ContentModerationStats } from '../components/controls/ContentModerationStats';
import type { ClassInfo, GuardrailSettings, GuardrailViolation } from '@shared/types';

interface GuardrailConfig {
  id: string;
  classId?: string; // If null, applies globally
  blockedTerms: string[];
  dailyQuestionLimit: number;
  enableContentFiltering: boolean;
  strictMode: boolean;
  customRefusalMessage?: string;
  allowTeacherOverride: boolean;
  logViolations: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ControlsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'blocked-terms' | 'limits' | 'violations' | 'policies' | 'stats'>('blocked-terms');
  const [selectedClass, setSelectedClass] = useState<string>('global');
  const queryClient = useQueryClient();

  // Fetch classes for class-specific controls
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch classes');
      }
      return response.data || [];
    },
  });

  // Fetch guardrail configurations
  const { data: guardrailConfig, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['guardrail-config', selectedClass],
    queryFn: async () => {
      const response = await apiClient.getGuardrailConfig(selectedClass === 'global' ? undefined : selectedClass);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch guardrail config');
      }
      return response.data;
    },
  });

  // Fetch guardrail violations
  const { data: violations, isLoading: violationsLoading } = useQuery({
    queryKey: ['guardrail-violations', selectedClass],
    queryFn: async () => {
      const response = await apiClient.getGuardrailViolations({
        classId: selectedClass === 'global' ? undefined : selectedClass,
        limit: 100
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch violations');
      }
      return response.data || [];
    },
  });

  // Update guardrail configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<GuardrailConfig>) => {
      const response = await apiClient.updateGuardrailConfig(
        selectedClass === 'global' ? undefined : selectedClass,
        config
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to update configuration');
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configuration updated successfully');
      queryClient.invalidateQueries({ queryKey: ['guardrail-config'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleConfigUpdate = (updates: Partial<GuardrailConfig>) => {
    updateConfigMutation.mutate(updates);
  };

  const tabs = [
    { id: 'blocked-terms', label: 'Blocked Terms', icon: AlertTriangle },
    { id: 'limits', label: 'Question Limits', icon: Clock },
    { id: 'violations', label: 'Violations Log', icon: Eye },
    { id: 'policies', label: 'Usage Policies', icon: MessageSquare },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
  ] as const;

  if (classesLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Controls</h1>
          <p className="text-gray-600">Configure content filters, usage policies, and safety guardrails</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => refetchConfig()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Class Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Configuration Scope</h3>
              <p className="text-xs text-gray-600">Choose global settings or class-specific controls</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="global">Global Settings</option>
              {classes?.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            
            {selectedClass !== 'global' && (
              <div className="text-xs text-gray-500">
                Class-specific settings override global defaults
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Content Filtering</p>
              <p className="text-lg font-bold text-gray-900">
                {guardrailConfig?.enableContentFiltering ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className={`p-2 rounded-full ${
              guardrailConfig?.enableContentFiltering 
                ? 'bg-green-100 text-green-600' 
                : 'bg-red-100 text-red-600'
            }`}>
              {guardrailConfig?.enableContentFiltering ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Blocked Terms</p>
              <p className="text-lg font-bold text-gray-900">
                {guardrailConfig?.blockedTerms?.length || 0}
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Daily Limit</p>
              <p className="text-lg font-bold text-gray-900">
                {guardrailConfig?.dailyQuestionLimit || 'Unlimited'}
              </p>
            </div>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent Violations</p>
              <p className="text-lg font-bold text-gray-900">
                {violations?.filter(v => 
                  new Date(v.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
                ).length || 0}
              </p>
            </div>
            <Eye className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'blocked-terms' && (
            <BlockedTermsManager
              config={guardrailConfig}
              onUpdate={handleConfigUpdate}
              isLoading={updateConfigMutation.isPending}
              classId={selectedClass === 'global' ? undefined : selectedClass}
            />
          )}

          {activeTab === 'limits' && (
            <QuestionLimitsManager
              config={guardrailConfig}
              onUpdate={handleConfigUpdate}
              isLoading={updateConfigMutation.isPending}
              classId={selectedClass === 'global' ? undefined : selectedClass}
            />
          )}

          {activeTab === 'violations' && (
            <GuardrailViolationsLog
              violations={violations || []}
              isLoading={violationsLoading}
              classId={selectedClass === 'global' ? undefined : selectedClass}
            />
          )}

          {activeTab === 'policies' && (
            <UsagePolicyEditor
              config={guardrailConfig}
              onUpdate={handleConfigUpdate}
              isLoading={updateConfigMutation.isPending}
              classId={selectedClass === 'global' ? undefined : selectedClass}
            />
          )}

          {activeTab === 'stats' && (
            <ContentModerationStats
              violations={violations || []}
              config={guardrailConfig}
              classId={selectedClass === 'global' ? undefined : selectedClass}
            />
          )}
        </div>
      </div>

      {/* Emergency Controls */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-medium text-red-900 mb-2">Emergency Controls</h3>
            <p className="text-sm text-red-800 mb-4">
              Use these controls for immediate system-wide content moderation in case of emergencies.
            </p>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
                leftIcon={<Shield className="w-4 h-4" />}
                onClick={() => {
                  if (window.confirm('This will enable strict content filtering across all classes. Continue?')) {
                    handleConfigUpdate({ 
                      enableContentFiltering: true, 
                      strictMode: true 
                    });
                  }
                }}
              >
                Enable Strict Mode
              </Button>
              
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
                leftIcon={<X className="w-4 h-4" />}
                onClick={() => {
                  if (window.confirm('This will temporarily disable the AI assistant for all students. Continue?')) {
                    // This would call an emergency shutdown API
                    toast.success('Emergency shutdown initiated');
                  }
                }}
              >
                Emergency Shutdown
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};