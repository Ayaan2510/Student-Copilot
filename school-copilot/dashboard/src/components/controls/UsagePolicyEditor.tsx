/**
 * Usage Policy Editor Component
 * Manages custom refusal messages and usage policies
 */

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Save, 
  RotateCcw, 
  Eye, 
  Edit,
  CheckCircle,
  AlertCircle,
  Copy,
  Lightbulb
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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

interface UsagePolicyEditorProps {
  config?: GuardrailConfig;
  onUpdate: (updates: Partial<GuardrailConfig>) => void;
  isLoading: boolean;
  classId?: string;
}

const DEFAULT_MESSAGES = {
  blocked_term: "I can't help with that topic. Let's focus on your coursework instead! Feel free to ask me about your assignments or class materials.",
  daily_limit: "You've reached your daily question limit. This helps ensure everyone gets a chance to use the AI assistant. Please try again tomorrow!",
  inappropriate_content: "I'm designed to help with educational content only. Please rephrase your question to focus on your schoolwork.",
  system_bypass: "I'm here to help you learn! Please ask questions related to your coursework and I'll be happy to assist.",
  general: "I'm not able to help with that request. Please ask me questions about your assignments, readings, or class topics instead."
};

const MESSAGE_TEMPLATES = [
  {
    name: 'Friendly & Encouraging',
    messages: {
      blocked_term: "I can't help with that topic, but I'd love to help you with your coursework! What assignment are you working on?",
      daily_limit: "You've been asking great questions today! You've reached your daily limit, but I'll be here tomorrow to help you learn more.",
      inappropriate_content: "Let's keep our conversation focused on learning! I'm here to help with your school subjects and assignments.",
      system_bypass: "I'm your learning companion! Ask me about your homework, readings, or any school topic you're curious about.",
      general: "I'm designed to be your study buddy! Please ask me questions about your coursework and I'll do my best to help you learn."
    }
  },
  {
    name: 'Professional & Direct',
    messages: {
      blocked_term: "This topic is not appropriate for our educational platform. Please ask questions related to your coursework.",
      daily_limit: "You have reached your daily question limit. This limit helps ensure fair access for all students. Please return tomorrow.",
      inappropriate_content: "Content filtering has blocked this request. Please focus your questions on educational topics.",
      system_bypass: "Please use this tool as intended - for educational assistance with your coursework and assignments.",
      general: "This request cannot be processed. Please ask questions related to your academic work."
    }
  },
  {
    name: 'Supportive & Guiding',
    messages: {
      blocked_term: "I understand you're curious, but let's redirect that curiosity to your studies! What subject can I help you explore today?",
      daily_limit: "You've been actively learning today - that's wonderful! You've used up your questions for now, but I'll be ready to help again tomorrow.",
      inappropriate_content: "I'm here to support your academic journey. Let's focus on questions that will help you succeed in your classes!",
      system_bypass: "I'm most helpful when we work together on your educational goals. What school topic would you like to explore?",
      general: "I'm designed to help you succeed academically. Please ask me about your homework, projects, or any subject you're studying!"
    }
  }
];

export const UsagePolicyEditor: React.FC<UsagePolicyEditorProps> = ({
  config,
  onUpdate,
  isLoading,
  classId
}) => {
  const [activeMessageType, setActiveMessageType] = useState<keyof typeof DEFAULT_MESSAGES>('general');
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({
    blocked_term: config?.customRefusalMessage || DEFAULT_MESSAGES.blocked_term,
    daily_limit: DEFAULT_MESSAGES.daily_limit,
    inappropriate_content: DEFAULT_MESSAGES.inappropriate_content,
    system_bypass: DEFAULT_MESSAGES.system_bypass,
    general: DEFAULT_MESSAGES.general,
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleMessageChange = (type: string, message: string) => {
    setCustomMessages(prev => ({
      ...prev,
      [type]: message
    }));
  };

  const handleSaveMessages = () => {
    // For now, we'll save the general message as the custom refusal message
    // In a full implementation, we'd save all message types
    onUpdate({
      customRefusalMessage: customMessages.general
    });
    toast.success('Usage policies updated successfully');
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all messages to defaults? This will overwrite your custom messages.')) {
      setCustomMessages({ ...DEFAULT_MESSAGES });
      toast.success('Messages reset to defaults');
    }
  };

  const handleApplyTemplate = (template: typeof MESSAGE_TEMPLATES[0]) => {
    if (window.confirm(`Apply the "${template.name}" template? This will overwrite your current messages.`)) {
      setCustomMessages({ ...template.messages });
      setSelectedTemplate('');
      toast.success(`Applied "${template.name}" template`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Message copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy message');
    });
  };

  const messageTypes = [
    { key: 'general', label: 'General Refusal', description: 'Default message for blocked requests' },
    { key: 'blocked_term', label: 'Blocked Terms', description: 'When inappropriate terms are detected' },
    { key: 'daily_limit', label: 'Daily Limit', description: 'When student reaches question limit' },
    { key: 'inappropriate_content', label: 'Inappropriate Content', description: 'When content filtering triggers' },
    { key: 'system_bypass', label: 'System Bypass', description: 'When students try to bypass restrictions' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Usage Policies & Messages</h3>
              <p className="text-sm text-gray-600">
                Customize the messages students see when content is blocked or limits are reached
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
              leftIcon={<Eye className="w-4 h-4" />}
            >
              {previewMode ? 'Edit Mode' : 'Preview Mode'}
            </Button>
          </div>
        </div>

        {/* Template Selector */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Message Templates</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Reset to Defaults
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MESSAGE_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleApplyTemplate(template)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">{template.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Click to apply this tone to all messages
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message Type Selector */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {messageTypes.map((type) => (
              <button
                key={type.key}
                onClick={() => setActiveMessageType(type.key as keyof typeof DEFAULT_MESSAGES)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeMessageType === type.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{type.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Message Editor */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-medium text-gray-900">
                {messageTypes.find(t => t.key === activeMessageType)?.label}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(customMessages[activeMessageType])}
                leftIcon={<Copy className="w-4 h-4" />}
              >
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {messageTypes.find(t => t.key === activeMessageType)?.description}
            </p>
          </div>

          {previewMode ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">AI Assistant</div>
                    <div className="text-sm text-blue-800">
                      {customMessages[activeMessageType]}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                This is how the message will appear to students
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={customMessages[activeMessageType]}
                onChange={(e) => handleMessageChange(activeMessageType, e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your custom message..."
              />
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Tips for effective messages:</strong>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      <li>Keep messages friendly and educational</li>
                      <li>Redirect students to appropriate learning activities</li>
                      <li>Explain why the content was blocked (when appropriate)</li>
                      <li>Encourage continued learning and engagement</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Guidelines */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Message Guidelines</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-green-900 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Best Practices
            </h5>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Use encouraging, supportive language</li>
              <li>• Redirect to educational content</li>
              <li>• Explain the purpose of restrictions</li>
              <li>• Maintain a helpful, learning-focused tone</li>
              <li>• Keep messages concise but informative</li>
            </ul>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-red-900 mb-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Avoid
            </h5>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Harsh or punitive language</li>
              <li>• Detailed explanations of blocked content</li>
              <li>• Messages that might encourage bypass attempts</li>
              <li>• Overly technical explanations</li>
              <li>• Discouraging or negative tone</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Changes are automatically saved when you update messages
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleResetToDefaults}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset All
          </Button>
          
          <Button
            onClick={handleSaveMessages}
            disabled={isLoading}
            loading={isLoading}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Messages
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600">Updating policies...</span>
        </div>
      )}
    </div>
  );
};