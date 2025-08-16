/**
 * Citation Service Tests
 * Tests for citation extraction, validation, and document linking
 */

import { CitationService, DocumentReference, DocumentSection } from '../citation-service';
import { Citation } from '@shared/types';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    id: 'test-extension-id'
  }
};

(global as any).chrome = mockChrome;

describe('CitationService', () => {
  let citationService: CitationService;
  let mockDocuments: DocumentReference[];

  beforeEach(() => {
    citationService = CitationService.getInstance();
    citationService.clearCache();
    
    mockDocuments = [
      {
        id: 'doc1',
        title: 'Introduction to Computer Science',
        type: 'pdf',
        pageCount: 100,
        sections: [
          { id: 'sec1', title: 'Chapter 1: Basics', startPage: 1, endPage: 20, level: 1 },
          { id: 'sec2', title: 'Section 1.1: Variables', startPage: 5, endPage: 10, level: 2 }
        ]
      },
      {
        id: 'doc2',
        title: 'Advanced Algorithms',
        type: 'pdf',
        pageCount: 200,
        sections: [
          { id: 'sec3', title: 'Chapter 2: Sorting', startPage: 25, endPage: 50, level: 1 }
        ]
      }
    ];

    mockChrome.runtime.sendMessage.mockClear();
  });

  describe('extractCitations', () => {
    it('should extract page references from text', () => {
      const responseText = 'As mentioned on page 15, the algorithm works efficiently. See also p. 20 for more details.';
      const citations = citationService.extractCitations(responseText, mockDocuments);

      expect(citations).toHaveLength(2);
      expect(citations[0].page).toBe(15);
      expect(citations[1].page).toBe(20);
    });

    it('should extract section references from text', () => {
      const responseText = 'Chapter 1 discusses the basics, while section 1.1 covers variables in detail.';
      const citations = citationService.extractCitations(responseText, mockDocuments);

      expect(citations.length).toBeGreaterThan(0);
      expect(citations.some(c => c.section?.includes('Chapter 1'))).toBe(true);
    });

    it('should handle page ranges', () => {
      const responseText = 'The topic is covered on pages 15-20 and pp. 25-30.';
      const citations = citationService.extractCitations(responseText, mockDocuments);

      expect(citations.length).toBeGreaterThan(0);
      expect(citations.some(c => c.page === 15)).toBe(true);
      expect(citations.some(c => c.page === 25)).toBe(true);
    });

    it('should create implicit citations for all source documents', () => {
      const responseText = 'This is a general response without specific citations.';
      const citations = citationService.extractCitations(responseText, mockDocuments);

      expect(citations).toHaveLength(mockDocuments.length);
      expect(citations[0].documentId).toBe('doc1');
      expect(citations[1].documentId).toBe('doc2');
    });

    it('should deduplicate citations', () => {
      const responseText = 'Page 15 is important. As shown on page 15, the concept is clear.';
      const citations = citationService.extractCitations(responseText, mockDocuments);

      const page15Citations = citations.filter(c => c.page === 15);
      expect(page15Citations).toHaveLength(1);
    });
  });

  describe('validateCitation', () => {
    it('should validate correct page numbers', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test1',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        page: 50
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect page numbers exceeding document length', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test2',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        page: 150 // Exceeds 100 pages
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Page 150 exceeds document length (100 pages)');
      expect(result.suggestions).toContain('Check if page number should be 100');
    });

    it('should detect invalid page numbers', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test3',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        page: -5
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Page number must be positive');
    });

    it('should validate section references', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test4',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        section: 'Chapter 1: Basics'
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(true);
    });

    it('should detect non-existent sections', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test5',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        section: 'Chapter 99: Non-existent'
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Section "Chapter 99: Non-existent" not found in document');
    });

    it('should check page-section consistency', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test6',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        page: 50, // Outside of Chapter 1 range (1-20)
        section: 'Chapter 1: Basics'
      };

      const result = await citationService.validateCitation(citation);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Page 50 is not in Chapter 1: Basics (pages 1-20)');
    });

    it('should provide corrected citations', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citation: Citation = {
        id: 'test7',
        title: 'Introduction to Computer Science',
        documentId: 'doc1',
        page: 150 // Exceeds document length
      };

      const result = await citationService.validateCitation(citation);
      expect(result.correctedCitation).toBeDefined();
      expect(result.correctedCitation!.page).toBe(100);
    });
  });

  describe('generateDocumentUrl', () => {
    it('should generate URL with page parameter', () => {
      const citation: Citation = {
        id: 'test8',
        title: 'Test Document',
        documentId: 'doc1',
        page: 25
      };

      const url = citationService.generateDocumentUrl(citation);
      expect(url).toContain('doc=doc1');
      expect(url).toContain('page=25');
    });

    it('should generate URL with section anchor', () => {
      const citation: Citation = {
        id: 'test9',
        title: 'Test Document',
        documentId: 'doc1',
        section: 'Chapter 1: Introduction'
      };

      const url = citationService.generateDocumentUrl(citation);
      expect(url).toContain('#chapter-1-introduction');
    });

    it('should generate URL with both page and section', () => {
      const citation: Citation = {
        id: 'test10',
        title: 'Test Document',
        documentId: 'doc1',
        page: 15,
        section: 'Variables'
      };

      const url = citationService.generateDocumentUrl(citation);
      expect(url).toContain('page=15');
      expect(url).toContain('#variables');
    });
  });

  describe('openCitation', () => {
    it('should successfully open citation', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const citation: Citation = {
        id: 'test11',
        title: 'Test Document',
        documentId: 'doc1',
        page: 10
      };

      const result = await citationService.openCitation(citation);
      expect(result).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'open_document',
        data: expect.objectContaining({
          documentId: 'doc1',
          page: 10
        })
      });
    });

    it('should handle opening failures', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ 
        success: false, 
        error: 'Document not found' 
      });

      const citation: Citation = {
        id: 'test12',
        title: 'Test Document',
        documentId: 'nonexistent',
        page: 10
      };

      const result = await citationService.openCitation(citation);
      expect(result).toBe(false);
    });

    it('should log citation access', async () => {
      mockChrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true }) // open_document
        .mockResolvedValueOnce({ success: true }); // log_activity

      const citation: Citation = {
        id: 'test13',
        title: 'Test Document',
        documentId: 'doc1',
        page: 10
      };

      await citationService.openCitation(citation);
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'log_activity',
        data: expect.objectContaining({
          type: 'citation_access',
          action: 'open_document'
        })
      });
    });
  });

  describe('validateCitations (batch)', () => {
    it('should validate multiple citations in parallel', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      const citations: Citation[] = [
        { id: 'test14', title: 'Doc 1', documentId: 'doc1', page: 10 },
        { id: 'test15', title: 'Doc 1', documentId: 'doc1', page: 20 },
        { id: 'test16', title: 'Doc 1', documentId: 'doc1', page: 200 } // Invalid
      ];

      const results = await citationService.validateCitations(citations);
      
      expect(results.size).toBe(3);
      expect(results.get('test14')?.isValid).toBe(true);
      expect(results.get('test15')?.isValid).toBe(true);
      expect(results.get('test16')?.isValid).toBe(false);
    });
  });

  describe('caching', () => {
    it('should cache document references', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      // First call should fetch from API
      await citationService.getDocumentReference('doc1');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await citationService.getDocumentReference('doc1');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      await citationService.getDocumentReference('doc1');
      
      const stats = citationService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.documents).toContain('doc1');
    });

    it('should clear cache', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: mockDocuments[0]
      });

      await citationService.getDocumentReference('doc1');
      expect(citationService.getCacheStats().size).toBe(1);

      citationService.clearCache();
      expect(citationService.getCacheStats().size).toBe(0);
    });
  });
});