/**
 * Integration Tests for Class Management
 * Tests class creation, student management, and access control
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ClassesPage } from '../../pages/ClassesPage';
import { apiClient } from '../../services/api';
import type { ClassInfo } from '@shared/types';

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    getClasses: vi.fn(),
    createClass: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
    getClassStudents: vi.fn(),
    setClassAccess: vi.fn(),
    importStudents: vi.fn(),
  }
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

const mockClasses: ClassInfo[] = [
  {
    id: '1',
    name: 'Introduction to Computer Science',
    description: 'Basic CS concepts',
    teacherId: 'teacher1',
    enabled: true,
    studentCount: 25,
    documentCount: 5,
    createdDate: new Date('2024-01-15'),
    dailyQuestionLimit: 20,
    blockedTerms: ['inappropriate', 'blocked'],
    allowAnonymousQuestions: false,
    requireApproval: false,
    enableLogging: true,
  },
  {
    id: '2',
    name: 'Advanced Mathematics',
    teacherId: 'teacher1',
    enabled: false,
    studentCount: 18,
    documentCount: 3,
    createdDate: new Date('2024-02-01'),
  }
];

const mockStudents = [
  {
    id: 'student1',
    name: 'John Doe',
    email: 'john.doe@school.edu',
    enabled: true,
    lastActivity: new Date('2024-03-01'),
    queryCount: 15,
  },
  {
    id: 'student2',
    name: 'Jane Smith',
    email: 'jane.smith@school.edu',
    enabled: false,
    lastActivity: new Date('2024-02-28'),
    queryCount: 8,
  }
];

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Class Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.getClasses as any).mockResolvedValue({
      success: true,
      data: mockClasses,
    });
  });

  describe('Classes Page', () => {
    it('should display classes list', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
      });

      // Check stats
      expect(screen.getByText('2')).toBeInTheDocument(); // Total classes
      expect(screen.getByText('1')).toBeInTheDocument(); // Active classes
      expect(screen.getByText('43')).toBeInTheDocument(); // Total students (25 + 18)
    });

    it('should filter classes by search term', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search classes...');
      fireEvent.change(searchInput, { target: { value: 'Computer' } });

      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Mathematics')).not.toBeInTheDocument();
    });

    it('should filter classes by status', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue('All Classes');
      fireEvent.change(filterSelect, { target: { value: 'enabled' } });

      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      expect(screen.queryByText('Advanced Mathematics')).not.toBeInTheDocument();
    });

    it('should open create class modal', async () => {
      renderWithProviders(<ClassesPage />);

      const addButton = screen.getByText('Add Class');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Class')).toBeInTheDocument();
      });
    });
  });

  describe('Class Creation', () => {
    it('should create a new class', async () => {
      (apiClient.createClass as any).mockResolvedValue({
        success: true,
        data: { id: '3', name: 'New Class', enabled: true },
      });

      renderWithProviders(<ClassesPage />);

      // Open create modal
      const addButton = screen.getByText('Add Class');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Class')).toBeInTheDocument();
      });

      // Fill form
      const nameInput = screen.getByPlaceholderText('e.g., Introduction to Computer Science');
      fireEvent.change(nameInput, { target: { value: 'New Test Class' } });

      const descriptionInput = screen.getByPlaceholderText('Optional description of the class...');
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

      // Submit form
      const createButton = screen.getByText('Create Class');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(apiClient.createClass).toHaveBeenCalledWith({
          name: 'New Test Class',
          description: 'Test description',
          enabled: true,
        });
      });
    });

    it('should validate required fields', async () => {
      renderWithProviders(<ClassesPage />);

      // Open create modal
      const addButton = screen.getByText('Add Class');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Class')).toBeInTheDocument();
      });

      // Try to submit without name
      const createButton = screen.getByText('Create Class');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Class name is required')).toBeInTheDocument();
      });
    });
  });

  describe('Student Roster Management', () => {
    beforeEach(() => {
      (apiClient.getClassStudents as any).mockResolvedValue({
        success: true,
        data: mockStudents,
      });
    });

    it('should display student roster', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Find and click View Roster button
      const viewRosterButtons = screen.getAllByText('View Roster');
      fireEvent.click(viewRosterButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Student Roster - Introduction to Computer Science')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should toggle student access', async () => {
      (apiClient.setClassAccess as any).mockResolvedValue({ success: true });

      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Open roster modal
      const viewRosterButtons = screen.getAllByText('View Roster');
      fireEvent.click(viewRosterButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find and click disable button for John Doe
      const disableButtons = screen.getAllByText('Disable');
      fireEvent.click(disableButtons[0]);

      await waitFor(() => {
        expect(apiClient.setClassAccess).toHaveBeenCalledWith({
          classId: '1',
          studentId: 'student1',
          enabled: false,
          action: 'disable_student',
        });
      });
    });

    it('should search students', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Open roster modal
      const viewRosterButtons = screen.getAllByText('View Roster');
      fireEvent.click(viewRosterButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Search for John
      const searchInput = screen.getByPlaceholderText('Search students...');
      fireEvent.change(searchInput, { target: { value: 'John' } });

      // John should be visible, Jane should not
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  describe('CSV Import', () => {
    it('should open import modal', async () => {
      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Find and click Import CSV button
      const importButtons = screen.getAllByText('Import CSV');
      fireEvent.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Import Students - Introduction to Computer Science')).toBeInTheDocument();
      });
    });

    it('should download template', async () => {
      // Mock URL.createObjectURL and related methods
      const mockCreateObjectURL = vi.fn(() => 'mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement and appendChild
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const mockCreateElement = vi.fn(() => mockLink);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      
      document.createElement = mockCreateElement;
      document.body.appendChild = mockAppendChild;
      document.body.removeChild = mockRemoveChild;

      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Open import modal
      const importButtons = screen.getAllByText('Import CSV');
      fireEvent.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Download Template')).toBeInTheDocument();
      });

      // Click download template
      const downloadButton = screen.getByText('Download Template');
      fireEvent.click(downloadButton);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe('student-roster-template.csv');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  describe('Class Access Control', () => {
    it('should toggle class access', async () => {
      (apiClient.setClassAccess as any).mockResolvedValue({ success: true });

      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Find disable button for enabled class
      const disableButtons = screen.getAllByText('Disable Class');
      fireEvent.click(disableButtons[0]);

      await waitFor(() => {
        expect(apiClient.setClassAccess).toHaveBeenCalledWith({
          classId: '1',
          enabled: false,
          action: 'disable_class',
        });
      });
    });

    it('should delete class with confirmation', async () => {
      (apiClient.deleteClass as any).mockResolvedValue({ success: true });
      
      // Mock window.confirm
      const mockConfirm = vi.fn(() => true);
      global.confirm = mockConfirm;

      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
      });

      // Open menu and click delete
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('aria-label') === null
      );
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          const deleteButton = screen.getByText('Delete Class');
          fireEvent.click(deleteButton);
        });

        expect(mockConfirm).toHaveBeenCalledWith(
          'Are you sure you want to delete this class? This action cannot be undone.'
        );
        expect(apiClient.deleteClass).toHaveBeenCalledWith('1');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (apiClient.getClasses as any).mockRejectedValue(new Error('API Error'));

      renderWithProviders(<ClassesPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load classes')).toBeInTheDocument();
      });
    });

    it('should handle create class errors', async () => {
      (apiClient.createClass as any).mockResolvedValue({
        success: false,
        error: 'Class name already exists',
      });

      renderWithProviders(<ClassesPage />);

      // Open create modal and submit
      const addButton = screen.getByText('Add Class');
      fireEvent.click(addButton);

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('e.g., Introduction to Computer Science');
        fireEvent.change(nameInput, { target: { value: 'Test Class' } });

        const createButton = screen.getByText('Create Class');
        fireEvent.click(createButton);
      });

      // Should show error toast (mocked)
      await waitFor(() => {
        expect(apiClient.createClass).toHaveBeenCalled();
      });
    });
  });
});