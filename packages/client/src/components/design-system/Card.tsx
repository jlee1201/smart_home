import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  footer
}) => {
  return (
    <div className={`farmhouse-card ${className}`}>
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="font-serif">{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      
      <div className="card-body">
        {children}
      </div>
      
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}; 