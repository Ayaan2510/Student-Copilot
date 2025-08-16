/**
 * Citation Panel Component
 * Displays document citations with accessibility features and validation
 */

import React, { useState, useEffect } from 'react';
import { Citation } from '@shared/types';
import { citationService, CitationValidationResult } from '../../services/citation-service';

interface CitationPanelProps {
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
  showValidation?: boolean;
}

interface CitationState {
  validationResults: Map<string, CitationValidationResult>;
  loading: Set<string>;
  expanded: Set<string>;
}

export const CitationPanel: React.FC<CitationPanelProps> = ({ 
  citations, 
  onCitationClick,
  showValidation = false 
}) => {
  const [state, setState] = useState<CitationState>({
    validationResults: new Map(),
    loading: new Set(),
    expanded: new Set()
  });

  // Validate citations when they change
  useEffect(() => {
    if (showValidation && citations.length > 0) {
      validateCitations();
    }
  }, [citations, showValidation]);

  const validateCitations = async () => {
    const citationIds = citations.map(c => c.id);
    setState(prev => ({
      ...prev,
      loading: new Set(citationIds)
    }));

    try {
      const results = await citationService.validateCitations(citations);
      setState(prev => ({
        ...prev,
        validationResults: results,
        loading: new Set()
      }));
    } catch (error) {
      console.error('Failed to validate citations:', error);
      setState(prev => ({
        ...prev,
        loading: new Set()
      }));
    }
  };

  const handleCitationClick = async (citation: Citation) => {
    try {
      const success = await citationService.openCitation(citation);
      if (success) {
        onCitationClick(citation);
      } else {
        // Fallback to original handler
        onCitationClick(citation);
      }
    } catch (error) {
      console.error('Failed to open citation:', error);
      onCitationClick(citation);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, citation: Citation) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCitationClick(citation);
    }
  };

  const toggleExpanded = (citationId: string) => {
    setState(prev => {
      const newExpanded = new Set(prev.expanded);
      if (newExpanded.has(citationId)) {
        newExpanded.delete(citationId);
      } else {
        newExpanded.add(citationId);
      }
      return { ...prev, expanded: newExpanded };
    });
  };

  const getValidationIcon = (citation: Citation) => {
    const validation = state.validationResults.get(citation.id);
    if (!validation) return null;

    if (validation.isValid) {
      return <span className="citation-validation-icon valid" title="Citation validated">✓</span>;
    } else {
      return <span className="citation-validation-icon invalid" title={`Issues: ${validation.issues.join(', ')}`}>⚠</span>;
    }
  };

  const getConfidenceIndicator = (citation: Citation) => {
    const confidence = citation.confidence || citation.relevanceScore || 1;
    const level = confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';
    
    return (
      <div className={`citation-confidence ${level}`} title={`Confidence: ${Math.round(confidence * 100)}%`}>
        <div className="confidence-bar">
          <div 
            className="confidence-fill" 
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>
    );
  };

  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <div className="citations" role="region" aria-label="Source citations">
      <div className="citations-header">
        <div className="citations-title">
          <span>📚</span>
          Sources ({citations.length})
        </div>
        
        {showValidation && (
          <button 
            className="citations-validate-button"
            onClick={validateCitations}
            disabled={state.loading.size > 0}
            title="Validate all citations"
          >
            {state.loading.size > 0 ? '⏳' : '🔍'}
          </button>
        )}
      </div>
      
      <div className="citations-list" role="list">
        {citations.map((citation, index) => {
          const validation = state.validationResults.get(citation.id);
          const isExpanded = state.expanded.has(citation.id);
          const isLoading = state.loading.has(citation.id);

          return (
            <div
              key={citation.id}
              className={`citation-item ${validation && !validation.isValid ? 'has-issues' : ''}`}
              role="listitem"
            >
              <div
                className="citation-main"
                tabIndex={0}
                onClick={() => handleCitationClick(citation)}
                onKeyDown={(e) => handleKeyDown(e, citation)}
                aria-label={`Source ${index + 1}: ${citation.title}${(citation.page || citation.pageNumber) ? `, page ${citation.page || citation.pageNumber}` : ''}${citation.section ? `, section ${citation.section}` : ''}`}
              >
                <div className="citation-icon" aria-hidden="true">
                  {index + 1}
                </div>
                
                <div className="citation-content">
                  <div className="citation-title-row">
                    <div className="citation-title" title={citation.title}>
                      {citation.title}
                    </div>
                    
                    <div className="citation-indicators">
                      {showValidation && getValidationIcon(citation)}
                      {citation.confidence !== undefined && getConfidenceIndicator(citation)}
                      {isLoading && <span className="citation-loading">⏳</span>}
                    </div>
                  </div>
                  
                  <div className="citation-details">
                    {(citation.page || citation.pageNumber) && `Page ${citation.page || citation.pageNumber}`}
                    {(citation.page || citation.pageNumber) && citation.section && ' • '}
                    {citation.section && citation.section}
                  </div>
                  
                  {(citation.snippet || citation.contentPreview) && (
                    <div className="citation-snippet" title={citation.snippet || citation.contentPreview}>
                      "{citation.snippet || citation.contentPreview}"
                    </div>
                  )}
                </div>
                
                <div className="citation-actions">
                  {validation && !validation.isValid && (
                    <button
                      className="citation-expand-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(citation.id);
                      }}
                      title={isExpanded ? 'Hide issues' : 'Show issues'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                  
                  <div className="citation-action" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6.22 3.22a.75.75 0 011.06 0L12 7.94a.75.75 0 010 1.06L7.28 13.72a.75.75 0 01-1.06-1.06L10.44 8.5 6.22 4.28a.75.75 0 010-1.06z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Validation details */}
              {isExpanded && validation && !validation.isValid && (
                <div className="citation-validation-details">
                  {validation.issues.length > 0 && (
                    <div className="validation-issues">
                      <h5>Issues:</h5>
                      <ul>
                        {validation.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validation.suggestions.length > 0 && (
                    <div className="validation-suggestions">
                      <h5>Suggestions:</h5>
                      <ul>
                        {validation.suggestions.map((suggestion, i) => (
                          <li key={i}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validation.correctedCitation && (
                    <div className="validation-correction">
                      <h5>Suggested correction:</h5>
                      <div className="corrected-citation">
                        {(validation.correctedCitation.page || validation.correctedCitation.pageNumber) && `Page ${validation.correctedCitation.page || validation.correctedCitation.pageNumber}`}
                        {(validation.correctedCitation.page || validation.correctedCitation.pageNumber) && validation.correctedCitation.section && ' • '}
                        {validation.correctedCitation.section && validation.correctedCitation.section}
                      </div>
                      <button
                        className="apply-correction-button"
                        onClick={() => handleCitationClick(validation.correctedCitation!)}
                      >
                        Use correction
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {showValidation && state.validationResults.size > 0 && (
        <div className="citations-summary">
          <div className="validation-summary">
            {Array.from(state.validationResults.values()).filter(v => v.isValid).length} of {citations.length} citations validated
          </div>
        </div>
      )}
    </div>
  );
};