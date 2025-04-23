import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'text';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  let variantClass = '';
  if (variant === 'primary') variantClass = 'farmhouse-btn-primary';
  else if (variant === 'secondary') variantClass = 'farmhouse-btn-secondary';
  else if (variant === 'text') variantClass = 'farmhouse-btn-text';
  
  let sizeClass = '';
  if (size === 'sm') sizeClass = 'btn-sm';
  else if (size === 'lg') sizeClass = 'btn-lg';
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button 
      className={`farmhouse-btn ${variantClass} ${sizeClass} ${widthClass} ${className}`} 
      {...props}
    >
      {icon && <span className="button-icon">{icon}</span>}
      {children}
    </button>
  );
}; 