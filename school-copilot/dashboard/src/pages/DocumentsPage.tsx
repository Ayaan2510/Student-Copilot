/**
 * Documents Management Page
 * Complete document management interface with upload, assignment, and re-indexing
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Eye,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  FileIcon,
  Folder
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DocumentCard } from '../components/documents/DocumentCard';
import { UploadModal } from '../components/documents/UploadModal';
import { AssignDocumentModal } from '../components/documents/AssignDocumentModal';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { ReindexModal } from '../components/documents/ReindexModal';
import type { Document, ClassInfo } from '@shared/types';

export const DocumentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showReindexModal, setShowReindexModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'processing' | 'error'>('all');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'docx' | 'pptx' | 'txt'>('all');

  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const response = await apiClient.getDocuments();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch documents');
      }
      return response.data || [];
    },
  });

  // Fetch classes for assignment
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch classes');
      }
      return response.data || [];
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiClient.deleteDocument(documentId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete document');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Assign document mutation
  const assignDocumentMutation = useMutation({
    mutationFn: async ({ documentId, classIds }: { documentId: string; classIds: string[] }) => {
      const response = await apiClient.assignDocumentToClasses(documentId, classIds);
      if (!response.success) {
        throw new Error(response.error || 'Failed to assign document');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document assigned successfully');
      setShowAssignModal(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reindex document mutation
  const reindexDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiClient.reindexDocument(documentId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to reindex document');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document reindexing started');
      setShowReindexModal(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter documents based on search and filters
  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesType = filterType === 'all' || doc.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  const handleDeleteDocument = (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const handleAssignDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowAssignModal(true);
  };

  const handlePreviewDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowPreviewModal(true);
  };

  const handleReindexDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowReindexModal(true);
  };

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    setShowUploadModal(false);
  };

  const handleAssignSubmit = (classIds: string[]) => {
    if (selectedDocument) {
      assignDocumentMutation.mutate({
        documentId: selectedDocument.id,
        classIds
      });
    }
  };

  const handleReindexSubmit = () => {
    if (selectedDocument) {
      reindexDocumentMutation.mutate(selectedDocument.id);
    }
  };

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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load documents</h3>
        <p className="text-gray-600">Please try refreshing the page</p>
      </div>
    );
  }

  const stats = {
    total: documents?.length || 0,
    ready: documents?.filter(d => d.status === 'ready').length || 0,
    processing: documents?.filter(d => d.status === 'processing').length || 0,
    error: documents?.filter(d => d.status === 'error').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Upload and manage course materials</p>
        </div>
        <Button 
          leftIcon={<Upload className="w-4 h-4" />}
          onClick={() => setShowUploadModal(true)}
        >
          Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ready</p>
              <p className="text-3xl font-bold text-gray-900">{stats.ready}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-3xl font-bold text-gray-900">{stats.processing}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-3xl font-bold text-gray-900">{stats.error}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="error">Error</option>
            </select>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word</option>
              <option value="pptx">PowerPoint</option>
              <option value="txt">Text</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              classes={classes || []}
              onPreview={handlePreviewDocument}
              onAssign={handleAssignDocument}
              onReindex={handleReindexDocument}
              onDelete={handleDeleteDocument}
              isUpdating={
                deleteDocumentMutation.isPending || 
                assignDocumentMutation.isPending || 
                reindexDocumentMutation.isPending
              }
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all' 
              ? 'No documents found' 
              : 'No documents yet'
            }
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Upload your first document to get started'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && filterType === 'all' && (
            <Button 
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowUploadModal(true)}
            >
              Upload Document
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
        classes={classes || []}
      />

      {selectedDocument && (
        <>
          <AssignDocumentModal
            isOpen={showAssignModal}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedDocument(null);
            }}
            document={selectedDocument}
            classes={classes || []}
            onSubmit={handleAssignSubmit}
            isLoading={assignDocumentMutation.isPending}
          />

          <DocumentPreviewModal
            isOpen={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false);
              setSelectedDocument(null);
            }}
            document={selectedDocument}
          />

          <ReindexModal
            isOpen={showReindexModal}
            onClose={() => {
              setShowReindexModal(false);
              setSelectedDocument(null);
            }}
            document={selectedDocument}
            onSubmit={handleReindexSubmit}
            isLoading={reindexDocumentMutation.isPending}
          />
        </>
      )}
    </div>
  );
};