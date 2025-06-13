import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  tabIndex?: number;
  'aria-hidden'?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  checked, 
  onCheckedChange, 
  disabled = false,
  className = '',
  tabIndex,
  'aria-hidden': ariaHidden
}) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-hidden={ariaHidden}
      className={`
        w-4 h-4 rounded border-2 flex items-center justify-center
        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked 
          ? 'bg-blue-600 border-blue-600 text-white' 
          : 'bg-white border-gray-300 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {checked && <Check className="w-3 h-3" />}
    </button>
  );
};