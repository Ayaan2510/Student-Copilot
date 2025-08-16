/**
 * Blocked Terms Manager Component
 * Manages inappropriate content filtering and blocked terms configuration
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  AlertTriangle, 
  Search,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Shield
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

interface BlockedTermsManagerProps {
  config?: GuardrailConfig;
  onUpdate: (updates: Partial<GuardrailConfig>) => void;
  isLoading: boolean;
  classId?: string;
}

const DEFAULT_BLOCKED_TERMS = [
  // Academic dishonesty
  'cheat', 'cheating', 'plagiarize', 'copy homework', 'test answers',
  // Inappropriate content
  'violence', 'weapon', 'drug', 'alcohol', 'inappropriate',
  // Personal information requests
  'home address', 'phone number', 'social security', 'password',
  // Bypass attempts
  'ignore instructions', 'override system', 'jailbreak', 'pretend you are'
];

const TERM_CATEGORIES = [
  { id: 'academic', label: 'Academic Dishonesty', color: 'bg-red-100 text-red-800' },
  { id: 'inappropriate', label: 'Inappropriate Content', color: 'bg-orange-100 text-orange-800' },
  { id: 'personal', label: 'Personal Information', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'bypass', label: 'System Bypass', color: 'bg-purple-100 text-purple-800' },
  { id: 'custom', label: 'Custom Terms', color: 'bg-blue-100 text-blue-800' }
];

export const BlockedTermsManager: React.FC<BlockedTermsManagerProps> = ({
  config,
  onUpdate,
  isLoading,
  classId
}) => {
  const [newTerm, setNewTerm] = useState('');
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkTerms, setBulkTerms] = useState('');

  const blockedTerms = config?.blockedTerms || [];
  const enableContentFiltering = config?.enableContentFiltering ?? true;
  const strictMode = config?.strictMode ?? false;

  const filteredTerms = blockedTerms.filter(term => {
    const matchesSearch = term.toLowerCase().includes(searchTerm.toLowerCase());
    if (selectedCategory === 'all') return matchesSearch;
    
    // Simple categorization based on term content
    const termLower = term.toLowerCase();
    switch (selectedCategory) {
      case 'academic':
        return matchesSearch && (termLower.includes('cheat') || termLower.includes('plagiar') || termLower.includes('copy'));
      case 'inappropriate':
        return matchesSearch && (termLower.includes('violence') || termLower.includes('weapon') || termLower.includes('drug'));
      case 'personal':
        return matchesSearch && (termLower.includes('address') || termLower.includes('phone') || termLower.includes('password'));
      case 'bypass':
        return matchesSearch && (termLower.includes('ignore') || termLower.includes('override') || termLower.includes('jailbreak'));
      default:
        return matchesSearch;
    }
  });

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    
    const term = newTerm.trim().toLowerCase();
    if (blockedTerms.includes(term)) {
      toast.error('Term already exists in blocked list');
      return;
    }

    onUpdate({
      blockedTerms: [...blockedTerms, term]
    });
    
    setNewTerm('');
    toast.success('Blocked term added');
  };

  const handleRemoveTerm = (termToRemove: string) => {
    onUpdate({
      blockedTerms: blockedTerms.filter(term => term !== termToRemove)
    });
    toast.success('Blocked term removed');
  };

  const handleEditTerm = (oldTerm: string) => {
    setEditingTerm(oldTerm);
    setEditValue(oldTerm);
  };

  const handleSaveEdit = () => {
    if (!editValue.trim() || !editingTerm) return;
    
    const newTerm = editValue.trim().toLowerCase();
    if (newTerm !== editingTerm && blockedTerms.includes(newTerm)) {
      toast.error('Term already exists in blocked list');
      return;
    }

    const updatedTerms = blockedTerms.map(term => 
      term === editingTerm ? newTerm : term
    );
    
    onUpdate({
      blockedTerms: updatedTerms
    });
    
    setEditingTerm(null);
    setEditValue('');
    toast.success('Blocked term updated');
  };

  const handleCancelEdit = () => {
    setEditingTerm(null);
    setEditValue('');
  };

  const handleBulkImport = () => {
    const terms = bulkTerms
      .split('\n')
      .map(term => term.trim().toLowerCase())
      .filter(term => term.length > 0)
      .filter(term => !blockedTerms.includes(term));

    if (terms.length === 0) {
      toast.error('No new terms to import');
      return;
    }

    onUpdate({
      blockedTerms: [...blockedTerms, ...terms]
    });
    
    setBulkTerms('');
    setShowBulkImport(false);
    toast.success(`Imported ${terms.length} new blocked terms`);
  };

  const handleLoadDefaults = () => {
    const newTerms = DEFAULT_BLOCKED_TERMS.filter(term => !blockedTerms.includes(term));
    
    if (newTerms.length === 0) {
      toast.info('All default terms are already in your blocked list');
      return;
    }

    onUpdate({
      blockedTerms: [...blockedTerms, ...newTerms]
    });
    
    toast.success(`Added ${newTerms.length} default blocked terms`);
  };

  const handleExportTerms = () => {
    const termsText = blockedTerms.join('\n');
    const blob = new Blob([termsText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blocked-terms-${classId || 'global'}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Blocked terms exported');
  };

  return (
    <div className="space-y-6">
      {/* Content Filtering Toggle */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Content Filtering</h3>
              <p className="text-sm text-gray-600">Enable automatic detection and blocking of inappropriate content</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enableContentFiltering}
                onChange={(e) => onUpdate({ enableContentFiltering: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable Filtering</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => onUpdate({ strictMode: e.target.checked })}
                disabled={!enableContentFiltering}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">Strict Mode</span>
            </label>
          </div>
        </div>
        
        {strictMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Strict Mode:</strong> More aggressive filtering with lower tolerance for potentially inappropriate content. 
                May result in more false positives but provides maximum safety.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search blocked terms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {TERM_CATEGORIES.map(category => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadDefaults}
            leftIcon={<Shield className="w-4 h-4" />}
          >
            Load Defaults
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkImport(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Bulk Import
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTerms}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Add New Term */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Enter term or phrase to block..."
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTerm()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={handleAddTerm}
            disabled={!newTerm.trim() || isLoading}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Term
          </Button>
        </div>
      </div>

      {/* Blocked Terms List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Blocked Terms ({filteredTerms.length})
            </h3>
            {blockedTerms.length > 0 && (
              <div className="text-sm text-gray-500">
                {blockedTerms.length} total terms configured
              </div>
            )}
          </div>
        </div>
        
        {filteredTerms.length > 0 ? (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredTerms.map((term, index) => (
              <div key={term} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  {editingTerm === term ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        leftIcon={<Save className="w-3 h-3" />}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        leftIcon={<X className="w-3 h-3" />}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {term}
                        </span>
                        <div className="text-xs text-gray-500">
                          #{index + 1}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTerm(term)}
                          leftIcon={<Edit className="w-3 h-3" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTerm(term)}
                          leftIcon={<Trash2 className="w-3 h-3" />}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {searchTerm || selectedCategory !== 'all' ? 'No matching terms' : 'No blocked terms configured'}
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or category filter'
                : 'Add terms to block inappropriate content in student queries'
              }
            </p>
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Bulk Import Blocked Terms</h3>
              <button
                onClick={() => setShowBulkImport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms to Import (one per line)
                </label>
                <textarea
                  value={bulkTerms}
                  onChange={(e) => setBulkTerms(e.target.value)}
                  placeholder="Enter terms to block, one per line..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <div className="text-sm text-blue-800">
                  <strong>Tips:</strong>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>Enter one term or phrase per line</li>
                    <li>Terms will be automatically converted to lowercase</li>
                    <li>Duplicate terms will be ignored</li>
                    <li>Empty lines will be skipped</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowBulkImport(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={!bulkTerms.trim()}
                leftIcon={<Upload className="w-4 h-4" />}
              >
                Import Terms
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600">Updating configuration...</span>
        </div>
      )}
    </div>
  );
};