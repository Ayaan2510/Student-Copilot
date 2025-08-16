/**
 * Dashboard Overview Page
 * Provides summary statistics and quick actions for teachers
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  TrendingUp,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { apiClient } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/Button';

interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  totalDocuments: number;
  totalQueries: number;
  activeStudents: number;
  recentActivity: any[];
  systemStatus: 'healthy' | 'warning' | 'error';
}

export const DashboardPage: React.FC = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // In a real implementation, this would be a single endpoint
      const [classes, documents, logs, systemStatus] = await Promise.all([
        apiClient.getClasses(),
        apiClient.getDocuments(),
        apiClient.getAuditLogs({ limit: 10 }),
        apiClient.getSystemStatus(),
      ]);

      return {
        totalClasses: classes.data?.length || 0,
        totalStudents: classes.data?.reduce((sum, cls) => sum + (cls.studentCount || 0), 0) || 0,
        totalDocuments: documents.data?.length || 0,
        totalQueries: logs.data?.length || 0,
        activeStudents: 0, // Would be calculated from recent activity
        recentActivity: logs.data?.slice(0, 5) || [],
        systemStatus: systemStatus.success ? 'healthy' : 'warning',
      } as DashboardStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
        <p className="text-gray-600">Please try refreshing the page</p>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Classes',
      value: stats?.totalClasses || 0,
      icon: Users,
      color: 'blue',
      href: '/classes',
    },
    {
      name: 'Total Students',
      value: stats?.totalStudents || 0,
      icon: Users,
      color: 'green',
      href: '/classes',
    },
    {
      name: 'Documents',
      value: stats?.totalDocuments || 0,
      icon: FileText,
      color: 'purple',
      href: '/documents',
    },
    {
      name: 'Recent Queries',
      value: stats?.totalQueries || 0,
      icon: MessageSquare,
      color: 'orange',
      href: '/logs',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your School Co-Pilot system</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            stats?.systemStatus === 'healthy' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {stats?.systemStatus === 'healthy' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>System {stats?.systemStatus || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => window.location.href = stat.href}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="justify-start h-auto p-4"
            onClick={() => window.location.href = '/classes'}
          >
            <Users className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Manage Classes</div>
              <div className="text-sm text-gray-500">Add students and control access</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="justify-start h-auto p-4"
            onClick={() => window.location.href = '/documents'}
          >
            <FileText className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Upload Documents</div>
              <div className="text-sm text-gray-500">Add course materials</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="justify-start h-auto p-4"
            onClick={() => window.location.href = '/logs'}
          >
            <TrendingUp className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">View Activity</div>
              <div className="text-sm text-gray-500">Monitor student usage</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/logs'}>
            View all
          </Button>
        </div>
        
        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    Student query: "{activity.queryText?.substring(0, 50)}..."
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(activity.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>{activity.success ? 'Success' : 'Failed'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="mx-auto h-8 w-8 mb-2" />
            <p>No recent activity</p>
          </div>
        )}
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">API Service</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Document Processing</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Vector Database</span>
          </div>
        </div>
      </div>
    </div>
  );
};