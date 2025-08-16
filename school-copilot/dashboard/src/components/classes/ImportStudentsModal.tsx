/**
 * Import Students Modal Component
 * CSV import functionality for student roster management
 */

import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ClassInfo } from '@shared/types';

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassInfo;
  onImport: (csvData: string) => void;
}

interface ParsedStudent {
  name: string;
  email: string;
  valid: boolean;
  errors: string[];
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  isOpen,
  onClose,
  classInfo,
  onImport
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const parseCSV = (content: string) => {
    setIsProcessing(true);
    
    try {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }

      // Skip header row
      const dataLines = lines.slice(1);
      const students: ParsedStudent[] = [];

      dataLines.forEach((line, index) => {
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        
        if (columns.length < 2) {
          students.push({
            name: '',
            email: '',
            valid: false,
            errors: [`Row ${index + 2}: Not enough columns (expected at least 2)`]
          });
          return;
        }

        const [name, email] = columns;
        const errors: string[] = [];

        // Validate name
        if (!name || name.length < 2) {
          errors.push('Name is required and must be at least 2 characters');
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          errors.push('Valid email address is required');
        }

        students.push({
          name,
          email,
          valid: errors.length === 0,
          errors
        });
      });

      setParsedStudents(students);
      setStep('preview');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to parse CSV');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    const validStudents = parsedStudents.filter(s => s.valid);
    if (validStudents.length === 0) {
      alert('No valid students to import');
      return;
    }

    setStep('importing');
    
    // Convert back to CSV format for the API
    const csvData = [
      'name,email',
      ...validStudents.map(s => `"${s.name}","${s.email}"`).join('\n')
    ].join('\n');

    onImport(csvData);
  };

  const downloadTemplate = () => {
    const template = 'name,email\n"John Doe","john.doe@school.edu"\n"Jane Smith","jane.smith@school.edu"';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-roster-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsvContent('');
    setParsedStudents([]);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  const validCount = parsedStudents.filter(s => s.valid).length;
  const invalidCount = parsedStudents.length - validCount;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={step !== 'importing' ? handleClose : undefined}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Import Students - {classInfo.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Upload a CSV file to add students to this class
                </p>
              </div>
            </div>
            {step !== 'importing' && (
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• First row should be headers: <code>name,email</code></li>
                  <li>• Each subsequent row should contain student name and email</li>
                  <li>• Email addresses must be valid format</li>
                  <li>• Names must be at least 2 characters long</li>
                </ul>
              </div>

              {/* Template Download */}
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Download Template
                </Button>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Select CSV File
                </h4>
                <p className="text-gray-600 mb-4">
                  Choose a CSV file containing student names and email addresses
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<Upload className="w-4 h-4" />}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Choose File'}
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-green-900">{validCount}</div>
                  <div className="text-sm text-green-700">Valid Students</div>
                </div>
                
                {invalidCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-red-600 mb-2" />
                    <div className="text-2xl font-bold text-red-900">{invalidCount}</div>
                    <div className="text-sm text-red-700">Invalid Entries</div>
                  </div>
                )}
              </div>

              {/* Student List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {parsedStudents.map((student, index) => (
                    <div key={index} className={`p-3 ${student.valid ? 'bg-white' : 'bg-red-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{student.name || 'Missing Name'}</div>
                          <div className="text-sm text-gray-600">{student.email || 'Missing Email'}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {student.valid ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      </div>
                      {!student.valid && student.errors.length > 0 && (
                        <div className="mt-2">
                          {student.errors.map((error, errorIndex) => (
                            <div key={errorIndex} className="text-xs text-red-600">
                              • {error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={reset}>
                  Choose Different File
                </Button>
                <div className="space-x-3">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={validCount === 0}
                  >
                    Import {validCount} Student{validCount !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Importing Students...
              </h4>
              <p className="text-gray-600">
                Please wait while we add the students to your class
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};