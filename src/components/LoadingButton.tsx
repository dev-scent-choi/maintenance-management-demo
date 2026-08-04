import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  children,
  loadingText,
  disabled,
  className = '',
  ...props
}) => {
  const t = useLanguage();
  const displayLoadingText = loadingText ?? t('processing');
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`${className} ${isLoading ? 'cursor-not-allowed' : ''}`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2">
          <Loader2 size={18} className="animate-spin" />
          <span>{displayLoadingText}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
