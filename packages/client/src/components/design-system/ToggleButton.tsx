import React from 'react';

type ToggleButtonVariant = 'power' | 'mute' | 'input' | 'sound-mode';
type ToggleButtonSize = 'sm' | 'md' | 'lg';

interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ToggleButtonVariant;
  size?: ToggleButtonSize;
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  variant,
  size = 'md',
  isActive,
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Size variants - with special handling for input/sound-mode buttons
  const getSizeStyles = () => {
    const baseStyles = {
      sm: { height: '2.5rem', fontSize: '0.875rem' },
      md: { height: '3.5rem', fontSize: '1rem' },
      lg: { height: '4rem', fontSize: '1.125rem' }
    };
    
    // For input and sound-mode buttons, make them wider to fit text
    if (variant === 'input' || variant === 'sound-mode') {
      return {
        ...baseStyles[size],
        width: size === 'sm' ? '5rem' : size === 'md' ? '7rem' : '8rem'
      };
    }
    
    // For power and mute buttons, keep them square/circular
    return {
      ...baseStyles[size],
      width: size === 'sm' ? '2.5rem' : size === 'md' ? '3.5rem' : '4rem'
    };
  };
  
  // Get colors based on variant and active state - using farmhouse-inspired colors
  const getColors = () => {
    if (isActive) {
      switch (variant) {
        case 'power':
          return { 
            backgroundColor: '#5C7666', // farmhouse-accent-green
            borderColor: '#8E846D', // farmhouse-brown
            color: 'white',
            boxShadow: '0 8px 12px -2px rgba(92, 118, 102, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          };
        case 'mute':
          return { 
            backgroundColor: '#BB8274', // farmhouse-accent-terracotta
            borderColor: '#C8C1B2', // farmhouse-taupe
            color: 'white',
            boxShadow: '0 8px 12px -2px rgba(187, 130, 116, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          };
        case 'input':
          return { 
            backgroundColor: '#6A869C', // farmhouse-accent-blue
            borderColor: '#8E846D', // farmhouse-brown
            color: 'white',
            boxShadow: '0 8px 12px -2px rgba(106, 134, 156, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          };
        case 'sound-mode':
          return { 
            backgroundColor: '#8E846D', // farmhouse-brown
            borderColor: '#C8C1B2', // farmhouse-taupe
            color: 'white',
            boxShadow: '0 8px 12px -2px rgba(142, 132, 109, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          };
        default:
          return { backgroundColor: '#4F4F4F', borderColor: 'transparent', color: 'white' };
      }
    } else {
      return { 
        backgroundColor: '#4F4F4F', // farmhouse-charcoal
        borderColor: 'transparent', 
        color: '#E4DED0', // farmhouse-beige
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      };
    }
  };
  
  // Shape styles based on variant
  const borderRadius = (variant === 'power' || variant === 'mute') ? '50%' : '0.5rem';
  
  // Base inline styles
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: '2px solid',
    borderRadius,
    ...getSizeStyles(),
    ...getColors()
  };
  
  return (
    <button 
      style={baseStyle}
      className={className}
      disabled={disabled}
      {...props}
    >
      <span style={{ fontWeight: isActive ? 'bold' : 'normal' }}>{children}</span>
    </button>
  );
}; 