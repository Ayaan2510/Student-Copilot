/**
 * Document Viewer Component
 * Displays documents with citation highlighting and navigation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Citation } from '@shared/types';
import { citationService, DocumentReference } from '../services/citation-service';

interface DocumentViewerProps {
  documentId: string;
  citation?: Citation;
  onClose: () => void;
  className?: string;
}

interface ViewerState {
  document: DocumentReference | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  searchTerm: string;
  searchResults: SearchResult[];
  currentSearchIndex: number;
}

interface SearchResult {
  page: number;
  text: string;
  position: { x: number; y: number };
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  citation,
  onClose,
  className = ''
}) => {
  const [state, setState] = useState<ViewerState>({
    document: null,
    loading: true,
    error: null,
    currentPage: citation?.page || 1,
    totalPages: 0,
    zoomLevel: 1,
    searchTerm: '',
    searchResults: [],
    currentSearchIndex: -1
  });

  const viewerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load document on mount
  useEffect(() => {
    loadDocument();
  }, [documentId]);

  // Navigate to citation location when citation changes
  useEffect(() => {
    if (citation && state.document) {
      navigateToCitation(citation);
    }
  }, [citation, state.document]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return;

      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (event.ctrlKey || event.metaKey) {
            previousPage();
          }
          break;
        case 'ArrowRight':
          if (event.ctrlKey || event.metaKey) {
            nextPage();
          }
          break;
        case '=':
        case '+':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            resetZoom();
          }
          break;
        case 'f':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            focusSearch();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.currentPage, state.totalPages]);

  const loadDocument = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const document = await citationService.getDocumentReference(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      setState(prev => ({
        ...prev,
        document,
        totalPages: document.pageCount || 1,
        loading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load document',
        loading: false
      }));
    }
  };

  const navigateToCitation = useCallback(async (citation: Citation) => {
    if (!citation) return;

    // Navigate to page
    if (citation.page) {
      setState(prev => ({ ...prev, currentPage: citation.page! }));
    }

    // Highlight section if specified
    if (citation.section) {
      await highlightSection(citation.section);
    }

    // Scroll to citation snippet if available
    if (citation.snippet) {
      await scrollToText(citation.snippet);
    }
  }, []);

  const highlightSection = async (sectionTitle: string) => {
    // This would highlight the section in the document
    // Implementation depends on document format
    console.log('Highlighting section:', sectionTitle);
  };

  const scrollToText = async (text: string) => {
    // This would scroll to and highlight the specific text
    // Implementation depends on document format
    console.log('Scrolling to text:', text);
  };

  const previousPage = () => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(1, prev.currentPage - 1)
    }));
  };

  const nextPage = () => {
    setState(prev => ({
      ...prev,
      currentPage: Math.min(prev.totalPages, prev.currentPage + 1)
    }));
  };

  const goToPage = (page: number) => {
    const targetPage = Math.max(1, Math.min(state.totalPages, page));
    setState(prev => ({ ...prev, currentPage: targetPage }));
  };

  const zoomIn = () => {
    setState(prev => ({
      ...prev,
      zoomLevel: Math.min(3, prev.zoomLevel + 0.25)
    }));
  };

  const zoomOut = () => {
    setState(prev => ({
      ...prev,
      zoomLevel: Math.max(0.5, prev.zoomLevel - 0.25)
    }));
  };

  const resetZoom = () => {
    setState(prev => ({ ...prev, zoomLevel: 1 }));
  };

  const focusSearch = () => {
    const searchInput = document.querySelector('.document-search-input') as HTMLInputElement;
    searchInput?.focus();
  };

  const handleSearch = async (searchTerm: string) => {
    setState(prev => ({ ...prev, searchTerm, searchResults: [], currentSearchIndex: -1 }));

    if (!searchTerm.trim()) return;

    // Simulate search results - in real implementation, this would search the document content
    const mockResults: SearchResult[] = [
      { page: 1, text: searchTerm, position: { x: 100, y: 200 } },
      { page: 3, text: searchTerm, position: { x: 150, y: 300 } }
    ];

    setState(prev => ({
      ...prev,
      searchResults: mockResults,
      currentSearchIndex: mockResults.length > 0 ? 0 : -1
    }));

    if (mockResults.length > 0) {
      goToPage(mockResults[0].page);
    }
  };

  const nextSearchResult = () => {
    if (state.searchResults.length === 0) return;

    const nextIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
    setState(prev => ({ ...prev, currentSearchIndex: nextIndex }));
    goToPage(state.searchResults[nextIndex].page);
  };

  const previousSearchResult = () => {
    if (state.searchResults.length === 0) return;

    const prevIndex = state.currentSearchIndex === 0 
      ? state.searchResults.length - 1 
      : state.currentSearchIndex - 1;
    setState(prev => ({ ...prev, currentSearchIndex: prevIndex }));
    goToPage(state.searchResults[prevIndex].page);
  };

  if (state.loading) {
    return (
      <div className={`document-viewer ${className}`}>
        <div className="document-viewer-loading">
          <div className="loading-spinner"></div>
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`document-viewer ${className}`}>
        <div className="document-viewer-error">
          <h3>Error Loading Document</h3>
          <p>{state.error}</p>
          <button onClick={onClose} className="error-close-button">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`document-viewer ${className}`} ref={viewerRef}>
      {/* Header */}
      <div className="document-viewer-header">
        <div className="document-info">
          <h2 className="document-title">{state.document?.title}</h2>
          <span className="document-type">{state.document?.type.toUpperCase()}</span>
        </div>

        <div className="document-controls">
          {/* Search */}
          <div className="document-search">
            <input
              type="text"
              className="document-search-input"
              placeholder="Search in document..."
              value={state.searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {state.searchResults.length > 0 && (
              <div className="search-navigation">
                <span className="search-results-count">
                  {state.currentSearchIndex + 1} of {state.searchResults.length}
                </span>
                <button onClick={previousSearchResult} className="search-nav-button">
                  ↑
                </button>
                <button onClick={nextSearchResult} className="search-nav-button">
                  ↓
                </button>
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div className="zoom-controls">
            <button onClick={zoomOut} className="zoom-button" title="Zoom out (Ctrl+-)">
              −
            </button>
            <span className="zoom-level">{Math.round(state.zoomLevel * 100)}%</span>
            <button onClick={zoomIn} className="zoom-button" title="Zoom in (Ctrl++)">
              +
            </button>
            <button onClick={resetZoom} className="zoom-reset" title="Reset zoom (Ctrl+0)">
              Reset
            </button>
          </div>

          {/* Close button */}
          <button onClick={onClose} className="document-close-button" title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="document-viewer-content" ref={contentRef}>
        <div 
          className="document-page"
          style={{ transform: `scale(${state.zoomLevel})` }}
        >
          {/* Document content would be rendered here */}
          <div className="document-placeholder">
            <h3>Document Content</h3>
            <p>Page {state.currentPage} of {state.totalPages}</p>
            <p>Document ID: {documentId}</p>
            {citation && (
              <div className="citation-highlight">
                <h4>Citation Location:</h4>
                {citation.page && <p>Page: {citation.page}</p>}
                {citation.section && <p>Section: {citation.section}</p>}
                {citation.snippet && <p>Context: "{citation.snippet}"</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="document-viewer-footer">
        <div className="page-navigation">
          <button 
            onClick={previousPage} 
            disabled={state.currentPage <= 1}
            className="page-nav-button"
            title="Previous page (Ctrl+←)"
          >
            ← Previous
          </button>

          <div className="page-input-container">
            <input
              type="number"
              className="page-input"
              value={state.currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              min={1}
              max={state.totalPages}
            />
            <span className="page-total">of {state.totalPages}</span>
          </div>

          <button 
            onClick={nextPage} 
            disabled={state.currentPage >= state.totalPages}
            className="page-nav-button"
            title="Next page (Ctrl+→)"
          >
            Next →
          </button>
        </div>

        <div className="document-actions">
          <button className="action-button" title="Print document">
            🖨️ Print
          </button>
          <button className="action-button" title="Download document">
            💾 Download
          </button>
        </div>
      </div>
    </div>
  );
};