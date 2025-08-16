/**
 * Question Limits Manager Component
 * Manages daily question limits and usage tracking
 */

import React, { useState } from 'react';
import { 
  Clock, 
  Users, 
  BarChart3, 
  Settings, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Calendar,
  User,
  RefreshCw
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { apiClient } from '../../services/api';

interface GuardrailConfig {
  id: string;
  classId?: string;
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

interface QuestionLimitsManagerProps {
  config?: GuardrailConfig;
  onUpdate: (updates: Partial<GuardrailConfig>) => void;
  isLoading: boolean;
  classId?: string;
}

interface UsageStats {
  totalQuestions: number;
  averagePerStudent: number;
  studentsAtLimit: number;
  peakUsageHour: number;
  dailyBreakdown: Array<{
    date: string;
    questions: number;
    uniqueStudents: number;
  }>;
  studentBreakdown: Array<{
    studentId: string;
    studentName: string;
    questionsToday: number;
    questionsThisWeek: number;
    lastActivity: string;
    isAtLimit: boolean;
  }>;
}

const PRESET_LIMITS = [
  { value: 0, label: 'Unlimited', description: 'No daily limit' },
  { value: 5, label: '5 questions', description: 'Light usage' },
  { value: 10, label: '10 questions', description: 'Moderate usage' },
  { value: 20, label: '20 questions', description: 'Heavy usage' },
  { value: 50, label: '50 questions', description: 'Very heavy usage' },
];

export const QuestionLimitsManager: React.FC<QuestionLimitsManagerProps> = ({
  config,
  onUpdate,
  isLoading,
  classId
}) => {
  const [customLimit, setCustomLimit] = useState(config?.dailyQuestionLimit || 0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch usage statistics
  const { data: usageStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['usage-stats', classId],
    queryFn: async () => {
      const response = await apiClient.getUsageStats(classId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch usage stats');
      }
      return response.data as UsageStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleLimitChange = (newLimit: number) => {
    setCustomLimit(newLimit);
    onUpdate({ dailyQuestionLimit: newLimit });
    
    if (newLimit === 0) {
      toast.success('Daily question limit removed');
    } else {
      toast.success(`Daily question limit set to ${newLimit}`);
    }
  };

  const handleCustomLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customLimit < 0) {
      toast.error('Limit cannot be negative');
      return;
    }
    handleLimitChange(customLimit);
  };

  const resetStudentLimit = async (studentId: string) => {
    try {
      const response = await apiClient.resetStudentQuestionCount(studentId);
      if (response.success) {
        toast.success('Student question count reset');
        refetchStats();
      } else {
        toast.error(response.error || 'Failed to reset student count');
      }
    } catch (error) {
      toast.error('Failed to reset student count');
    }
  };

  const currentLimit = config?.dailyQuestionLimit || 0;
  const stats = usageStats;

  return (
    <div className="space-y-6">
      {/* Current Limit Configuration */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Daily Question Limits</h3>
              <p className="text-sm text-gray-600">
                Control how many questions students can ask per day
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {currentLimit === 0 ? 'Unlimited' : currentLimit}
            </div>
            <div className="text-sm text-gray-500">
              {currentLimit === 0 ? 'No daily limit' : 'questions per day'}
            </div>
          </div>
        </div>

        {/* Preset Limits */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          {PRESET_LIMITS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleLimitChange(preset.value)}
              disabled={isLoading}
              className={`p-3 rounded-lg border text-left transition-colors ${
                currentLimit === preset.value
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">{preset.label}</div>
              <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* Custom Limit */}
        <div className="border-t border-gray-200 pt-4">
          <form onSubmit={handleCustomLimitSubmit} className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">Custom limit:</label>
            <input
              type="number"
              min="0"
              max="1000"
              value={customLimit}
              onChange={(e) => setCustomLimit(parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">questions per day</span>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || customLimit === currentLimit}
            >
              Apply
            </Button>
          </form>
        </div>

        {currentLimit > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Note:</strong> Students who reach their daily limit will receive a polite message 
                explaining the restriction and encouraging them to return tomorrow.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      {stats && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Usage Statistics</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchStats()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Questions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg per Student</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averagePerStudent.toFixed(1)}</p>
                </div>
                <User className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">At Daily Limit</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.studentsAtLimit}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-600" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Peak Hour</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.peakUsageHour}:00</p>
                </div>
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Daily Breakdown Chart */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">7-Day Usage Trend</h4>
            <div className="space-y-2">
              {stats.dailyBreakdown.map((day, index) => {
                const maxQuestions = Math.max(...stats.dailyBreakdown.map(d => d.questions));
                const percentage = maxQuestions > 0 ? (day.questions / maxQuestions) * 100 : 0;
                
                return (
                  <div key={day.date} className="flex items-center space-x-3">
                    <div className="w-16 text-xs text-gray-600 text-right">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                      <div 
                        className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                        {day.questions} questions
                      </div>
                    </div>
                    <div className="w-12 text-xs text-gray-600 text-right">
                      {day.uniqueStudents} users
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Student Usage</h4>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAdvanced ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {showAdvanced && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <div className="grid grid-cols-5 gap-4 text-xs font-medium text-gray-600 uppercase tracking-wide">
                    <div>Student</div>
                    <div>Today</div>
                    <div>This Week</div>
                    <div>Last Activity</div>
                    <div>Actions</div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {stats.studentBreakdown.map((student) => (
                    <div key={student.studentId} className="px-4 py-3">
                      <div className="grid grid-cols-5 gap-4 items-center">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            student.isAtLimit ? 'bg-red-500' : 'bg-green-500'
                          }`} />
                          <span className="text-sm font-medium text-gray-900">
                            {student.studentName}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-900">
                          {student.questionsToday}
                          {currentLimit > 0 && (
                            <span className="text-gray-500">/{currentLimit}</span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-900">
                          {student.questionsThisWeek}
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          {new Date(student.lastActivity).toLocaleString()}
                        </div>
                        
                        <div>
                          {student.isAtLimit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resetStudentLimit(student.studentId)}
                              className="text-xs"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {statsLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading usage statistics...</span>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config?.allowTeacherOverride ?? true}
              onChange={(e) => onUpdate({ allowTeacherOverride: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Allow Teacher Override</div>
              <div className="text-sm text-gray-500">
                Teachers can temporarily increase limits for individual students
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config?.logViolations ?? true}
              onChange={(e) => onUpdate({ logViolations: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Log Limit Violations</div>
              <div className="text-sm text-gray-500">
                Record when students attempt to exceed their daily limits
              </div>
            </div>
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600">Updating limits...</span>
        </div>
      )}
    </div>
  );
};