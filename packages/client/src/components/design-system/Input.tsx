import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  fullWidth = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const isInvalid = !!error;
  
  return (
    <div className={`farmhouse-input-wrapper ${fullWidth ? 'full-width' : ''}`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="farmhouse-input-label"
        >
          {label}
        </label>
      )}
      
      <input
        id={inputId}
        className={`farmhouse-input ${isInvalid ? 'error' : ''} ${className}`}
        aria-invalid={isInvalid}
        aria-describedby={`${inputId}-helper ${inputId}-error`}
        {...props}
      />
      
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="input-helper-text">
          {helperText}
        </p>
      )}
      
      {error && (
        <p id={`${inputId}-error`} className="input-error-text">
          {error}
        </p>
      )}
    </div>
  );
}; 