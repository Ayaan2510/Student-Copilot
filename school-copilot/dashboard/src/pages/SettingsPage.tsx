/**
 * Settings Page
 * System configuration and preferences
 */

import React from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure system preferences and account settings</p>
        </div>
        <Button leftIcon={<Save className="w-4 h-4" />}>
          Save Changes
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">System Settings</h3>
        <p className="text-gray-600 mb-4">
          Basic settings functionality is available.
        </p>
        <p className="text-sm text-gray-500">
          Additional configuration options will be added in future updates.
        </p>
      </div>
    </div>
  );
};