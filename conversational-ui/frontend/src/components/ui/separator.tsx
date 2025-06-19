import React from 'react';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator: React.FC<SeparatorProps> = ({ 
  orientation = 'horizontal', 
  className = '' 
}) => {
  const orientationClass = orientation === 'vertical' 
    ? 'h-full w-px' 
    : 'h-px w-full';
  
  return (
    <div 
      className={`bg-border ${orientationClass} ${className}`}
      role="separator"
      aria-orientation={orientation}
    />
  );
};