# Requirements Document

## Introduction

The School Co-Pilot Chrome Extension is a privacy-focused educational assistant that provides students with AI-powered help using only school-approved documents. The system consists of a Chrome extension for students, a teacher dashboard for control and monitoring, and a RAG (Retrieval-Augmented Generation) backend that ensures all responses come exclusively from the school's document corpus. Teachers maintain complete control over student access, document management, and usage monitoring while ensuring FERPA compliance.

## Requirements

### Requirement 1

**User Story:** As a student, I want to ask questions and receive answers sourced only from my school's approved documents, so that I can get reliable, curriculum-aligned help without accessing external information.

#### Acceptance Criteria

1. WHEN a student submits a query THEN the system SHALL search only within the document corpus assigned to their class
2. WHEN the answer cannot be found in the assigned documents THEN the system SHALL respond with "I can't find this in the school materials" and SHALL NOT provide external information
3. WHEN an answer is provided THEN the system SHALL include citations showing the specific document name, page number, and section
4. WHEN a student clicks on a citation THEN the system SHALL open the source document at the referenced location
5. IF a student is not assigned to any active class THEN the system SHALL display an access denied message

### Requirement 2

**User Story:** As a teacher, I want complete control over which students can access the system and which documents they can query, so that I can ensure appropriate educational boundaries and content access.

#### Acceptance Criteria

1. WHEN a teacher disables access for a class THEN all students in that class SHALL be immediately blocked from using the extension
2. WHEN a teacher disables access for an individual student THEN only that student SHALL be blocked while other class members retain access
3. WHEN a teacher uploads new documents THEN the teacher SHALL be able to assign those documents to specific classes
4. WHEN a teacher removes a document from a class THEN students in that class SHALL no longer receive answers from that document
5. WHEN a teacher sets daily question limits THEN students SHALL be prevented from exceeding those limits

### Requirement 3

**User Story:** As a teacher, I want to monitor student usage through audit logs, so that I can understand how students are using the system and ensure appropriate usage patterns.

#### Acceptance Criteria

1. WHEN a student submits a question THEN the system SHALL log the timestamp, student identifier, question text, and class context
2. WHEN a teacher accesses the audit logs THEN the system SHALL display filterable logs by class, student, and date range
3. WHEN a teacher exports logs THEN the system SHALL provide CSV format with no personally identifiable information beyond school email or student ID
4. WHEN viewing logs THEN the system SHALL display the last 50 questions by default with pagination for older entries
5. IF a student's access is disabled THEN their query attempts SHALL still be logged for monitoring purposes

### Requirement 4

**User Story:** As a student, I want a clean, distraction-free interface similar to GitHub Copilot, so that I can focus on learning without visual clutter or overwhelming features.

#### Acceptance Criteria

1. WHEN the extension loads THEN the interface SHALL display a neutral color palette with muted grays and whites
2. WHEN displaying messages THEN the system SHALL use clear message bubbles with generous spacing and rounded corners
3. WHEN background animations are enabled THEN the system SHALL display subtle, low-opacity animations that pause when the window loses focus
4. WHEN a user enables "Reduce motion" THEN all animations SHALL stop immediately
5. WHEN using keyboard navigation THEN all controls SHALL be accessible via keyboard with proper ARIA labels

### Requirement 5

**User Story:** As a school administrator, I want the system to be FERPA-compliant and maintain strict data isolation, so that student privacy is protected and data remains within school control.

#### Acceptance Criteria

1. WHEN processing student data THEN the system SHALL store no personally identifiable information beyond what is approved by teachers
2. WHEN a student queries the system THEN no data SHALL be sent to external services or APIs
3. WHEN documents are processed THEN all embedding and indexing SHALL occur locally or on school-controlled servers
4. WHEN students access different classes THEN document collections SHALL remain completely isolated between classes
5. IF the backend becomes unavailable THEN the extension SHALL display an offline message and SHALL NOT fabricate answers

### Requirement 6

**User Story:** As a teacher, I want to configure content guardrails and usage policies, so that I can ensure students receive appropriate responses and maintain classroom standards.

#### Acceptance Criteria

1. WHEN a teacher sets blocked terms THEN student queries containing those terms SHALL receive a polite refusal message
2. WHEN a teacher sets daily question limits THEN students SHALL see their remaining question count
3. WHEN a student exceeds daily limits THEN the system SHALL prevent further queries until the next day
4. WHEN a teacher configures class-specific settings THEN those settings SHALL apply only to the designated class
5. WHEN guardrails are triggered THEN the incident SHALL be logged for teacher review

### Requirement 7

**User Story:** As a student, I want quick access to common academic tasks like summarizing, defining terms, and explaining steps, so that I can efficiently get the type of help I need.

#### Acceptance Criteria

1. WHEN the interface loads THEN the system SHALL display quick action chips for "Summarize", "Define", and "Explain Steps"
2. WHEN a student clicks a quick action THEN the system SHALL modify their query with the appropriate prompt template
3. WHEN using the keyboard shortcut Alt+Shift+C THEN the extension SHALL open immediately
4. WHEN a student selects text on a webpage THEN the extension SHALL offer to explain or define the selected content using school documents
5. WHEN providing explanations THEN the system SHALL structure responses clearly with numbered steps or bullet points

### Requirement 8

**User Story:** As a teacher, I want an intuitive document management system, so that I can easily upload, organize, and maintain the document corpus for my classes.

#### Acceptance Criteria

1. WHEN uploading documents THEN the system SHALL support PDF, DOCX, PPTX, TXT, and Google Drive links
2. WHEN documents are uploaded THEN the system SHALL automatically chunk and embed them for the RAG pipeline
3. WHEN viewing the document list THEN the system SHALL show upload status, last updated time, and assigned classes
4. WHEN a teacher triggers re-indexing THEN the system SHALL update the vector embeddings and notify when complete
5. WHEN deleting documents THEN the system SHALL remove them from all assigned classes and update the index

### Requirement 9

**User Story:** As a system administrator, I want the Chrome extension to follow security best practices and minimal permissions, so that the school's IT policies are maintained and security risks are minimized.

#### Acceptance Criteria

1. WHEN the extension is installed THEN it SHALL request only the minimum required permissions: storage, scripting, activeTab, sidePanel, commands
2. WHEN the extension starts THEN it SHALL produce no console errors and load without security warnings
3. WHEN handling authentication THEN the system SHALL use JWT tokens with role-based claims
4. WHEN storing data locally THEN the system SHALL encrypt sensitive information and clear cache appropriately
5. IF permissions are modified THEN the extension SHALL require explicit user consent

### Requirement 10

**User Story:** As a student with accessibility needs, I want the extension to support accessibility features, so that I can use the system effectively regardless of my abilities.

#### Acceptance Criteria

1. WHEN using screen readers THEN all interface elements SHALL have proper ARIA labels and roles
2. WHEN navigating with keyboard only THEN all functionality SHALL be accessible via keyboard shortcuts
3. WHEN high contrast mode is enabled THEN the interface SHALL adapt to provide sufficient color contrast
4. WHEN motion sensitivity is a concern THEN the "Reduce motion" setting SHALL disable all animations
5. WHEN text size is increased THEN the interface SHALL scale appropriately without breaking layout