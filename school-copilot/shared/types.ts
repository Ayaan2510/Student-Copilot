// Shared TypeScript types for School Co-Pilot

export interface QueryRequest {
  studentId: string;
  classId: string;
  query: string;
  timestamp: Date;
  sessionId: string;
  quickAction?: 'summarize' | 'define' | 'explain';
  selectedText?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  usedDocuments: DocumentReference[];
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface Citation {
  id: string;
  documentId: string;
  title: string; // Alias for documentName for consistency
  documentName?: string; // Keep for backward compatibility
  page?: number; // Alias for pageNumber
  pageNumber?: number; // Keep for backward compatibility
  section?: string;
  chunkId?: string;
  relevanceScore?: number; // Alias for confidence
  confidence?: number; // 0-1 confidence score for citation accuracy
  contentPreview?: string; // Alias for snippet
  snippet?: string; // Text snippet from the document
  canOpenSource?: boolean;
  url?: string; // Direct URL to the citation location
}

export interface DocumentReference {
  id: string;
  name: string;
  type: DocumentType;
  lastAccessed: Date;
}

export type DocumentType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'gdrive';

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  uploadDate: Date;
  assignedClasses: string[];
  chunks: DocumentChunk[];
  metadata: DocumentMetadata;
  status: 'processing' | 'ready' | 'error';
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding?: number[];
  pageNumber?: number;
  section?: string;
  tokenCount: number;
}

export interface DocumentMetadata {
  fileSize: number;
  pageCount?: number;
  author?: string;
  createdDate?: Date;
  tags: string[];
}

export interface ClassAccess {
  classId: string;
  enabled: boolean;
  studentOverrides: Map<string, boolean>;
  documentIds: string[];
  dailyQuestionLimit: number;
  blockedTerms: string[];
}

export interface StudentInfo {
  id: string;
  email: string;
  name: string;
  classIds: string[];
  enabled: boolean;
  dailyQuestionCount: number;
  lastActivity?: Date;
}

export interface ClassInfo {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
  enabled: boolean;
  studentCount: number;
  documentCount: number;
  createdDate: Date;
  dailyQuestionLimit?: number;
  blockedTerms?: string[];
  allowAnonymousQuestions?: boolean;
  requireApproval?: boolean;
  enableLogging?: boolean;
}

export interface TeacherUser {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'admin';
  classIds: string[];
}

export interface AuthResponse {
  token: string;
  user: TeacherUser | StudentInfo;
  role: 'teacher' | 'student' | 'admin';
  expiresAt: Date;
}

export interface LoginRequest {
  email: string;
  password?: string;
  domain: string;
}

export interface UploadResponse {
  documentId: string;
  status: 'uploaded' | 'processing' | 'error';
  message?: string;
}

export interface StatusResponse {
  success: boolean;
  message: string;
  data?: any;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AccessRequest {
  classId: string;
  studentId?: string;
  enabled: boolean;
  action: 'enable_class' | 'disable_class' | 'enable_student' | 'disable_student';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  logType: 'query' | 'document' | 'authentication' | 'system';
  action: string;
  success: boolean;
  userId?: string;
  classId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export interface LogFilters {
  startDate?: Date;
  endDate?: Date;
  logType?: string;
  userId?: string;
  classId?: string;
  success?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

// Guardrail and Content Moderation types
export interface GuardrailSettings {
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

export interface GuardrailViolation {
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

export interface ActivityLog {
  type: 'query' | 'login' | 'access_denied' | 'rate_limit';
  studentId: string;
  classId?: string;
  details: string;
  timestamp: Date;
}

export interface PermissionStatus {
  hasAccess: boolean;
  reason?: string;
  remainingQuestions?: number;
  classEnabled: boolean;
  studentEnabled: boolean;
}

export interface ExtensionSettings {
  reduceMotion: boolean;
  highContrast: boolean;
  selectedClassId?: string;
  apiBaseUrl: string;
  sessionToken?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

// Extension message types for communication between components
export interface ExtensionMessage {
  type: 'query' | 'settings_update' | 'permission_check' | 'text_selection';
  data: any;
  requestId?: string;
}

// Error types
export class SchoolCopilotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SchoolCopilotError';
  }
}

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;