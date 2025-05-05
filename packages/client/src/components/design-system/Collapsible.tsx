import React, { useState } from 'react';

interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  iconPosition?: 'left' | 'right';
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  children,
  isOpen: defaultOpen = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  iconPosition = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className={`farmhouse-collapsible ${className}`}>
      <button
        className={`farmhouse-collapsible-header ${titleClassName} ${isOpen ? 'open' : 'closed'}`}
        onClick={toggleOpen}
        aria-expanded={isOpen}
      >
        {iconPosition === 'left' && (
          <span className="collapsible-icon">
            {isOpen ? '▼' : '▶'}
          </span>
        )}
        <span className="collapsible-title">{title}</span>
        {iconPosition === 'right' && (
          <span className="collapsible-icon">
            {isOpen ? '▼' : '▶'}
          </span>
        )}
      </button>
      {isOpen && (
        <div className={`farmhouse-collapsible-content ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}; 