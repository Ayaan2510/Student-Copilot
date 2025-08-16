/**
 * Citation Service for School Co-Pilot Extension
 * Handles citation extraction, validation, and document linking
 */

import { Citation } from '@shared/types';

export interface DocumentReference {
  id: string;
  title: string;
  url?: string;
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'html' | 'unknown';
  pageCount?: number;
  sections?: DocumentSection[];
}

export interface DocumentSection {
  id: string;
  title: string;
  startPage?: number;
  endPage?: number;
  level: number; // 1 = chapter, 2 = section, 3 = subsection
}

export interface CitationMatch {
  citation: Citation;
  confidence: number;
  context: string;
  documentReference: DocumentReference;
}

export interface CitationValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  correctedCitation?: Citation;
}

export class CitationService {
  private static instance: CitationService;
  private documentCache: Map<string, DocumentReference> = new Map();
  private citationPatterns: RegExp[] = [];

  static getInstance(): CitationService {
    if (!CitationService.instance) {
      CitationService.instance = new CitationService();
    }
    return CitationService.instance;
  }

  constructor() {
    this.initializeCitationPatterns();
  }

  /**
   * Initialize citation extraction patterns
   */
  private initializeCitationPatterns(): void {
    this.citationPatterns = [
      // Page references: "page 5", "p. 10", "pp. 15-20"
      /(?:page|p\.?|pp\.?)\s*(\d+)(?:\s*[-–—]\s*(\d+))?/gi,
      
      // Section references: "section 2.1", "chapter 3"
      /(?:section|sec\.?|chapter|ch\.?)\s*(\d+(?:\.\d+)*)/gi,
      
      // Document titles in quotes or italics
      /"([^"]+)"|'([^']+)'|\*([^*]+)\*/g,
      
      // Academic citations: (Author, Year, p. X)
      /\(([^,]+),\s*(\d{4}),\s*(?:p\.?\s*)?(\d+)\)/g,
      
      // Slide references: "slide 5", "slides 10-15"
      /(?:slide|slides?)\s*(\d+)(?:\s*[-–—]\s*(\d+))?/gi
    ];
  }

  /**
   * Extract citations from RAG response text
   */
  extractCitations(responseText: string, sourceDocuments: DocumentReference[]): Citation[] {
    const citations: Citation[] = [];
    const citationMap = new Map<string, Citation>();

    // Extract explicit citations from response text
    const explicitCitations = this.extractExplicitCitations(responseText, sourceDocuments);
    explicitCitations.forEach(citation => {
      const key = `${citation.documentId}_${citation.page || 0}_${citation.section || ''}`;
      if (!citationMap.has(key)) {
        citationMap.set(key, citation);
        citations.push(citation);
      }
    });

    // Extract implicit citations from context
    const implicitCitations = this.extractImplicitCitations(responseText, sourceDocuments);
    implicitCitations.forEach(citation => {
      const key = `${citation.documentId}_${citation.page || 0}_${citation.section || ''}`;
      if (!citationMap.has(key)) {
        citationMap.set(key, citation);
        citations.push(citation);
      }
    });

    // Sort citations by relevance and page number
    return citations.sort((a, b) => {
      if (a.documentId !== b.documentId) {
        return a.title.localeCompare(b.title);
      }
      return (a.page || 0) - (b.page || 0);
    });
  }

  /**
   * Extract explicit citations mentioned in the response
   */
  private extractExplicitCitations(text: string, sourceDocuments: DocumentReference[]): Citation[] {
    const citations: Citation[] = [];

    for (const pattern of this.citationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const citation = this.parseCitationMatch(match, sourceDocuments);
        if (citation) {
          citations.push(citation);
        }
      }
    }

    return citations;
  }

  /**
   * Extract implicit citations based on content similarity
   */
  private extractImplicitCitations(text: string, sourceDocuments: DocumentReference[]): Citation[] {
    const citations: Citation[] = [];

    // For each source document, create a basic citation
    sourceDocuments.forEach((doc, index) => {
      const snippet = this.extractRelevantSnippet(text, doc);
      const citation: Citation = {
        id: `implicit_${doc.id}_${index}`,
        title: doc.title,
        documentId: doc.id,
        snippet,
        contentPreview: snippet,
        confidence: 0.7, // Lower confidence for implicit citations
        relevanceScore: 0.7,
        canOpenSource: true
      };

      citations.push(citation);
    });

    return citations;
  }

  /**
   * Parse a citation match from regex
   */
  private parseCitationMatch(match: RegExpExecArray, sourceDocuments: DocumentReference[]): Citation | null {
    const fullMatch = match[0];
    const groups = match.slice(1);

    // Try to find matching document
    const document = this.findBestDocumentMatch(fullMatch, sourceDocuments);
    if (!document) return null;

    // Extract page numbers
    let page: number | undefined;
    let endPage: number | undefined;

    // Look for page numbers in the match
    const pageMatch = fullMatch.match(/(\d+)(?:\s*[-–—]\s*(\d+))?/);
    if (pageMatch) {
      page = parseInt(pageMatch[1]);
      if (pageMatch[2]) {
        endPage = parseInt(pageMatch[2]);
      }
    }

    // Extract section information
    const section = this.extractSectionFromMatch(fullMatch, document);

    return {
      id: `citation_${document.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: document.title,
      documentId: document.id,
      page,
      pageNumber: page, // For backward compatibility
      section,
      snippet: this.extractSnippetFromMatch(fullMatch),
      contentPreview: this.extractSnippetFromMatch(fullMatch),
      confidence: 0.9,
      relevanceScore: 0.9,
      canOpenSource: true
    };
  }

  /**
   * Find the best matching document for a citation
   */
  private findBestDocumentMatch(citationText: string, documents: DocumentReference[]): DocumentReference | null {
    if (documents.length === 0) return null;
    if (documents.length === 1) return documents[0];

    // Score documents based on title similarity
    const scores = documents.map(doc => ({
      document: doc,
      score: this.calculateSimilarity(citationText.toLowerCase(), doc.title.toLowerCase())
    }));

    // Sort by score and return the best match
    scores.sort((a, b) => b.score - a.score);
    
    // Only return if confidence is above threshold
    return scores[0].score > 0.3 ? scores[0].document : documents[0];
  }

  /**
   * Calculate text similarity score
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => 
      words2.some(w => w.includes(word) || word.includes(w))
    );
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Extract section information from citation match
   */
  private extractSectionFromMatch(match: string, document: DocumentReference): string | undefined {
    const sectionMatch = match.match(/(?:section|sec\.?|chapter|ch\.?)\s*(\d+(?:\.\d+)*)/i);
    if (sectionMatch) {
      const sectionNumber = sectionMatch[1];
      
      // Try to find the actual section title from document metadata
      const section = document.sections?.find(s => 
        s.title.toLowerCase().includes(sectionNumber) ||
        s.id.includes(sectionNumber)
      );
      
      return section ? section.title : `Section ${sectionNumber}`;
    }

    return undefined;
  }

  /**
   * Extract relevant snippet from citation match
   */
  private extractSnippetFromMatch(match: string): string | undefined {
    // Remove citation markers and return clean text
    const cleaned = match
      .replace(/(?:page|p\.?|pp\.?|section|sec\.?|chapter|ch\.?)\s*/gi, '')
      .replace(/[\d\s\-–—]+/g, ' ')
      .trim();

    return cleaned.length > 10 ? cleaned : undefined;
  }

  /**
   * Extract relevant snippet from response text for a document
   */
  private extractRelevantSnippet(text: string, document: DocumentReference): string | undefined {
    const sentences = text.split(/[.!?]+/);
    
    // Find sentences that might reference this document
    const relevantSentences = sentences.filter(sentence => {
      const words = document.title.toLowerCase().split(/\s+/);
      return words.some(word => 
        word.length > 3 && sentence.toLowerCase().includes(word)
      );
    });

    if (relevantSentences.length > 0) {
      return relevantSentences[0].trim().substring(0, 150) + '...';
    }

    // Fallback to first sentence
    return sentences[0]?.trim().substring(0, 150) + '...';
  }

  /**
   * Validate citation accuracy
   */
  async validateCitation(citation: Citation): Promise<CitationValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Get document reference
    const document = await this.getDocumentReference(citation.documentId);
    if (!document) {
      issues.push('Document not found');
      return { isValid: false, issues, suggestions };
    }

    // Validate page number
    if (citation.page) {
      if (document.pageCount && citation.page > document.pageCount) {
        issues.push(`Page ${citation.page} exceeds document length (${document.pageCount} pages)`);
        suggestions.push(`Check if page number should be ${Math.min(citation.page, document.pageCount)}`);
      }
      
      if (citation.page < 1) {
        issues.push('Page number must be positive');
        suggestions.push('Use page 1 or remove page reference');
      }
    }

    // Validate section reference
    if (citation.section && document.sections) {
      const sectionExists = document.sections.some(section => 
        section.title.toLowerCase().includes(citation.section!.toLowerCase()) ||
        citation.section!.toLowerCase().includes(section.title.toLowerCase())
      );
      
      if (!sectionExists) {
        issues.push(`Section "${citation.section}" not found in document`);
        const similarSections = this.findSimilarSections(citation.section, document.sections);
        if (similarSections.length > 0) {
          suggestions.push(`Did you mean: ${similarSections.map(s => s.title).join(', ')}?`);
        }
      }
    }

    // Check for consistency between page and section
    if (citation.page && citation.section && document.sections) {
      const section = document.sections.find(s => 
        s.title.toLowerCase().includes(citation.section!.toLowerCase())
      );
      
      if (section && section.startPage && section.endPage) {
        if (citation.page < section.startPage || citation.page > section.endPage) {
          issues.push(`Page ${citation.page} is not in ${citation.section} (pages ${section.startPage}-${section.endPage})`);
          suggestions.push(`Use page ${section.startPage}-${section.endPage} for this section`);
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      correctedCitation: issues.length > 0 ? this.generateCorrectedCitation(citation, document) : undefined
    };
  }

  /**
   * Find similar sections for suggestions
   */
  private findSimilarSections(sectionName: string, sections: DocumentSection[]): DocumentSection[] {
    return sections
      .map(section => ({
        section,
        similarity: this.calculateSimilarity(sectionName.toLowerCase(), section.title.toLowerCase())
      }))
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.section);
  }

  /**
   * Generate corrected citation
   */
  private generateCorrectedCitation(citation: Citation, document: DocumentReference): Citation {
    const corrected = { ...citation };

    // Correct page number if out of bounds
    if (citation.page && document.pageCount) {
      if (citation.page > document.pageCount) {
        corrected.page = document.pageCount;
      } else if (citation.page < 1) {
        corrected.page = 1;
      }
    }

    // Correct section reference
    if (citation.section && document.sections) {
      const similarSection = this.findSimilarSections(citation.section, document.sections)[0];
      if (similarSection) {
        corrected.section = similarSection.title;
        
        // Update page to match section if needed
        if (similarSection.startPage && (!corrected.page || corrected.page < similarSection.startPage)) {
          corrected.page = similarSection.startPage;
        }
      }
    }

    return corrected;
  }

  /**
   * Get document reference with caching
   */
  async getDocumentReference(documentId: string): Promise<DocumentReference | null> {
    // Check cache first
    if (this.documentCache.has(documentId)) {
      return this.documentCache.get(documentId)!;
    }

    try {
      // Fetch from API
      const response = await chrome.runtime.sendMessage({
        type: 'get_document_metadata',
        data: { documentId }
      });

      if (response.success && response.data) {
        const document: DocumentReference = response.data;
        this.documentCache.set(documentId, document);
        return document;
      }
    } catch (error) {
      console.error('Failed to fetch document reference:', error);
    }

    return null;
  }

  /**
   * Generate document URL for opening
   */
  generateDocumentUrl(citation: Citation): string | null {
    const baseUrl = this.getDocumentBaseUrl(citation.documentId);
    if (!baseUrl) return null;

    let url = baseUrl;

    // Add page parameter if supported
    if (citation.page) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}page=${citation.page}`;
    }

    // Add section anchor if supported
    if (citation.section) {
      const sectionId = this.generateSectionId(citation.section);
      url += `#${sectionId}`;
    }

    return url;
  }

  /**
   * Get base URL for document
   */
  private getDocumentBaseUrl(documentId: string): string | null {
    // This would typically come from the document metadata
    // For now, return a placeholder URL
    return `chrome-extension://${chrome.runtime.id}/viewer.html?doc=${documentId}`;
  }

  /**
   * Generate section ID for URL anchoring
   */
  private generateSectionId(sectionTitle: string): string {
    return sectionTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Open document at citation location
   */
  async openCitation(citation: Citation): Promise<boolean> {
    try {
      const url = this.generateDocumentUrl(citation);
      if (!url) {
        throw new Error('Cannot generate document URL');
      }

      // Send message to open document
      const response = await chrome.runtime.sendMessage({
        type: 'open_document',
        data: {
          documentId: citation.documentId,
          url,
          page: citation.page,
          section: citation.section
        }
      });

      if (response.success) {
        // Log citation access
        await this.logCitationAccess(citation);
        return true;
      } else {
        throw new Error(response.error || 'Failed to open document');
      }
    } catch (error) {
      console.error('Failed to open citation:', error);
      return false;
    }
  }

  /**
   * Log citation access for analytics
   */
  private async logCitationAccess(citation: Citation): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'log_activity',
        data: {
          type: 'citation_access',
          action: 'open_document',
          details: {
            documentId: citation.documentId,
            title: citation.title,
            page: citation.page,
            section: citation.section
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log citation access:', error);
    }
  }

  /**
   * Batch validate multiple citations
   */
  async validateCitations(citations: Citation[]): Promise<Map<string, CitationValidationResult>> {
    const results = new Map<string, CitationValidationResult>();

    // Process citations in parallel
    const validationPromises = citations.map(async (citation) => {
      const result = await this.validateCitation(citation);
      results.set(citation.id, result);
    });

    await Promise.all(validationPromises);
    return results;
  }

  /**
   * Clear document cache
   */
  clearCache(): void {
    this.documentCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; documents: string[] } {
    return {
      size: this.documentCache.size,
      documents: Array.from(this.documentCache.keys())
    };
  }
}

// Export singleton instance
export const citationService = CitationService.getInstance();