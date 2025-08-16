/**
 * Content Moderation Statistics Component
 * Displays analytics and insights for content moderation effectiveness
 */

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Shield, 
  AlertTriangle, 
  Clock, 
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

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

interface ContentModerationStatsProps {
  violations: GuardrailViolation[];
  config?: GuardrailConfig;
  classId?: string;
}

interface StatsData {
  totalViolations: number;
  violationsToday: number;
  violationsThisWeek: number;
  blockingEffectiveness: number;
  mostCommonViolationType: string;
  peakViolationHour: number;
  uniqueStudentsWithViolations: number;
  averageViolationsPerStudent: number;
  violationsByType: Array<{ type: string; count: number; percentage: number }>;
  violationsBySeverity: Array<{ severity: string; count: number; percentage: number }>;
  dailyTrend: Array<{ date: string; violations: number; blocked: number; flagged: number }>;
  hourlyPattern: Array<{ hour: number; violations: number }>;
  topBlockedTerms: Array<{ term: string; count: number }>;
  studentViolationDistribution: Array<{ range: string; count: number }>;
}

const calculateStats = (violations: GuardrailViolation[]): StatsData => {
  const now = new Date();
  const today = now.toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalViolations = violations.length;
  const violationsToday = violations.filter(v => new Date(v.timestamp).toDateString() === today).length;
  const violationsThisWeek = violations.filter(v => new Date(v.timestamp) >= weekAgo).length;

  // Calculate blocking effectiveness (blocked vs flagged)
  const blockedCount = violations.filter(v => v.action === 'blocked').length;
  const blockingEffectiveness = totalViolations > 0 ? (blockedCount / totalViolations) * 100 : 100;

  // Most common violation type
  const typeCounts = violations.reduce((acc, v) => {
    acc[v.violationType] = (acc[v.violationType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostCommonViolationType = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

  // Peak violation hour
  const hourCounts = violations.reduce((acc, v) => {
    const hour = new Date(v.timestamp).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const peakViolationHour = Object.entries(hourCounts).sort(([,a], [,b]) => b - a)[0]?.[0] ? parseInt(Object.entries(hourCounts).sort(([,a], [,b]) => b - a)[0][0]) : 0;

  // Unique students with violations
  const uniqueStudents = new Set(violations.map(v => v.studentId)).size;
  const averageViolationsPerStudent = uniqueStudents > 0 ? totalViolations / uniqueStudents : 0;

  // Violations by type
  const violationsByType = Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
    percentage: totalViolations > 0 ? (count / totalViolations) * 100 : 0
  })).sort((a, b) => b.count - a.count);

  // Violations by severity
  const severityCounts = violations.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const violationsBySeverity = Object.entries(severityCounts).map(([severity, count]) => ({
    severity,
    count,
    percentage: totalViolations > 0 ? (count / totalViolations) * 100 : 0
  })).sort((a, b) => b.count - a.count);

  // Daily trend (last 7 days)
  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toDateString();
    const dayViolations = violations.filter(v => new Date(v.timestamp).toDateString() === dateStr);
    
    return {
      date: date.toISOString().split('T')[0],
      violations: dayViolations.length,
      blocked: dayViolations.filter(v => v.action === 'blocked').length,
      flagged: dayViolations.filter(v => v.action === 'flagged').length
    };
  }).reverse();

  // Hourly pattern
  const hourlyPattern = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    violations: violations.filter(v => new Date(v.timestamp).getHours() === hour).length
  }));

  // Top blocked terms
  const termCounts = violations.reduce((acc, v) => {
    if (v.matchedTerms) {
      v.matchedTerms.forEach(term => {
        acc[term] = (acc[term] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);
  const topBlockedTerms = Object.entries(termCounts)
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Student violation distribution
  const studentViolationCounts = violations.reduce((acc, v) => {
    acc[v.studentId] = (acc[v.studentId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const distributionRanges = [
    { range: '1 violation', min: 1, max: 1 },
    { range: '2-3 violations', min: 2, max: 3 },
    { range: '4-5 violations', min: 4, max: 5 },
    { range: '6-10 violations', min: 6, max: 10 },
    { range: '10+ violations', min: 11, max: Infinity }
  ];
  
  const studentViolationDistribution = distributionRanges.map(range => ({
    range: range.range,
    count: Object.values(studentViolationCounts).filter(count => count >= range.min && count <= range.max).length
  }));

  return {
    totalViolations,
    violationsToday,
    violationsThisWeek,
    blockingEffectiveness,
    mostCommonViolationType,
    peakViolationHour,
    uniqueStudentsWithViolations: uniqueStudents,
    averageViolationsPerStudent,
    violationsByType,
    violationsBySeverity,
    dailyTrend,
    hourlyPattern,
    topBlockedTerms,
    studentViolationDistribution
  };
};

const getViolationTypeLabel = (type: string) => {
  switch (type) {
    case 'blocked_term':
      return 'Blocked Terms';
    case 'daily_limit':
      return 'Daily Limit';
    case 'inappropriate_content':
      return 'Inappropriate Content';
    case 'system_bypass':
      return 'System Bypass';
    default:
      return type;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'low':
      return 'bg-blue-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'high':
      return 'bg-orange-500';
    case 'critical':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

export const ContentModerationStats: React.FC<ContentModerationStatsProps> = ({
  violations,
  config,
  classId
}) => {
  const stats = calculateStats(violations);
  const maxHourlyViolations = Math.max(...stats.hourlyPattern.map(h => h.violations));
  const maxDailyViolations = Math.max(...stats.dailyTrend.map(d => d.violations));

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Violations</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalViolations}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Blocking Rate</p>
              <p className="text-3xl font-bold text-gray-900">{stats.blockingEffectiveness.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Content blocked successfully</p>
            </div>
            <Shield className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-3xl font-bold text-gray-900">{stats.violationsThisWeek}</p>
              <div className="flex items-center mt-1">
                {stats.violationsThisWeek > stats.violationsToday * 7 ? (
                  <TrendingUp className="w-3 h-3 text-red-500 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-green-500 mr-1" />
                )}
                <p className="text-xs text-gray-500">vs last week</p>
              </div>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Students Affected</p>
              <p className="text-3xl font-bold text-gray-900">{stats.uniqueStudentsWithViolations}</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg: {stats.averageViolationsPerStudent.toFixed(1)} per student
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">7-Day Trend</h3>
          </div>
          
          <div className="space-y-3">
            {stats.dailyTrend.map((day) => {
              const percentage = maxDailyViolations > 0 ? (day.violations / maxDailyViolations) * 100 : 0;
              
              return (
                <div key={day.date} className="flex items-center space-x-3">
                  <div className="w-16 text-xs text-gray-600 text-right">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div 
                      className="bg-red-500 h-6 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                      {day.violations} violations
                    </div>
                  </div>
                  <div className="w-20 text-xs text-gray-600">
                    {day.blocked}B / {day.flagged}F
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Pattern */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Hourly Pattern</h3>
          </div>
          
          <div className="space-y-2">
            {stats.hourlyPattern.filter(h => h.violations > 0).slice(0, 12).map((hour) => {
              const percentage = maxHourlyViolations > 0 ? (hour.violations / maxHourlyViolations) * 100 : 0;
              
              return (
                <div key={hour.hour} className="flex items-center space-x-3">
                  <div className="w-12 text-xs text-gray-600 text-right">
                    {hour.hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-orange-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-gray-600 text-right">
                    {hour.violations}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Violation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Violations by Type</h3>
          
          <div className="space-y-3">
            {stats.violationsByType.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm font-medium text-gray-900">
                    {getViolationTypeLabel(item.type)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Severity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Violations by Severity</h3>
          
          <div className="space-y-3">
            {stats.violationsBySeverity.map((item) => (
              <div key={item.severity} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded ${getSeverityColor(item.severity)}`}></div>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {item.severity}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getSeverityColor(item.severity)}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Blocked Terms */}
      {stats.topBlockedTerms.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Most Frequently Blocked Terms</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.topBlockedTerms.slice(0, 10).map((item, index) => (
              <div key={item.term} className="text-center">
                <div className="bg-red-100 text-red-800 rounded-lg p-3 mb-2">
                  <div className="text-lg font-bold">{item.count}</div>
                  <div className="text-xs">blocks</div>
                </div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {item.term}
                </div>
                <div className="text-xs text-gray-500">#{index + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Student Violation Distribution</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {stats.studentViolationDistribution.map((item) => (
            <div key={item.range} className="text-center">
              <div className="bg-gray-100 rounded-lg p-4 mb-2">
                <div className="text-2xl font-bold text-gray-900">{item.count}</div>
                <div className="text-xs text-gray-600">students</div>
              </div>
              <div className="text-sm font-medium text-gray-900">{item.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Content Moderation Health</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
              stats.blockingEffectiveness >= 95 ? 'bg-green-100' : 
              stats.blockingEffectiveness >= 85 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {stats.blockingEffectiveness >= 95 ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : stats.blockingEffectiveness >= 85 ? (
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <div className="text-sm font-medium text-gray-900">Blocking Effectiveness</div>
            <div className="text-xs text-gray-500">
              {stats.blockingEffectiveness >= 95 ? 'Excellent' : 
               stats.blockingEffectiveness >= 85 ? 'Good' : 'Needs Attention'}
            </div>
          </div>

          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
              stats.violationsToday <= 5 ? 'bg-green-100' : 
              stats.violationsToday <= 15 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              <Activity className={`w-8 h-8 ${
                stats.violationsToday <= 5 ? 'text-green-600' : 
                stats.violationsToday <= 15 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
            <div className="text-sm font-medium text-gray-900">Daily Activity</div>
            <div className="text-xs text-gray-500">
              {stats.violationsToday <= 5 ? 'Low' : 
               stats.violationsToday <= 15 ? 'Moderate' : 'High'}
            </div>
          </div>

          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
              config?.enableContentFiltering ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Shield className={`w-8 h-8 ${
                config?.enableContentFiltering ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div className="text-sm font-medium text-gray-900">Protection Status</div>
            <div className="text-xs text-gray-500">
              {config?.enableContentFiltering ? 'Active' : 'Disabled'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};