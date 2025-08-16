/**
 * Class Selector Component
 * Dropdown for selecting active class with accessibility features
 */

import React from 'react';
import { Class } from './SidePanel';

interface ClassSelectorProps {
  classes: Class[];
  selectedClass: string | null;
  onClassChange: (classId: string) => void;
  disabled?: boolean;
}

export const ClassSelector: React.FC<ClassSelectorProps> = ({
  classes,
  selectedClass,
  onClassChange,
  disabled = false
}) => {
  const enabledClasses = classes.filter(cls => cls.enabled);
  
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = event.target.value;
    if (classId) {
      onClassChange(classId);
    }
  };

  if (enabledClasses.length === 0) {
    return (
      <div className="class-selector">
        <label className="class-selector-label" htmlFor="class-select">
          Active Class
        </label>
        <div className="class-selector-empty">
          <span>No classes available</span>
          <small>Contact your teacher to enable access</small>
        </div>
      </div>
    );
  }

  return (
    <div className="class-selector">
      <label className="class-selector-label" htmlFor="class-select">
        Active Class
      </label>
      
      <select
        id="class-select"
        className="class-selector-dropdown"
        value={selectedClass || ''}
        onChange={handleChange}
        disabled={disabled}
        aria-describedby="class-select-help"
      >
        <option value="" disabled>
          Select a class...
        </option>
        {enabledClasses.map((cls) => (
          <option key={cls.id} value={cls.id}>
            {cls.name}
          </option>
        ))}
      </select>
      
      <div id="class-select-help" className="sr-only">
        Select the class you want to ask questions about. Only documents from the selected class will be used to answer your questions.
      </div>
    </div>
  );
};