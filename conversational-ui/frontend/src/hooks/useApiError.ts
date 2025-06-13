/**
 * Hook for handling API errors with user-friendly translations
 */

import { useState, useCallback } from 'react';
import { useErrorNotification } from '../components/errors';
import type { UserFriendlyError, ErrorResponse } from '../components/errors';

interface UseApiErrorOptions {
  showNotification?: boolean;
  fallbackMessage?: string;
  onError?: (error: UserFriendlyError) => void;
}

export const useApiError = (options: UseApiErrorOptions = {}) => {
  const {
    showNotification = true,
    fallbackMessage = 'An unexpected error occurred. Please try again.',
    onError
  } = options;

  const [error, setError] = useState<UserFriendlyError | null>(null);
  const [isError, setIsError] = useState(false);
  const { showError } = useErrorNotification();

  const handleApiError = useCallback((error: any) => {
    let userError: UserFriendlyError;

    // Check if it's already a user-friendly error response
    if (error?.error && typeof error.error === 'object') {
      userError = error.error as UserFriendlyError;
    }
    // Check if it's an axios-style error with response data
    else if (error?.response?.data?.error) {
      userError = error.response.data.error as UserFriendlyError;
    }
    // Check if it's a fetch error with json data
    else if (error?.json && typeof error.json === 'function') {
      error.json().then((data: ErrorResponse) => {
        if (data?.error) {
          handleApiError(data);
        }
      }).catch(() => {
        // If JSON parsing fails, create a generic error
        userError = {
          code: 'PARSE_ERROR',
          message: error.message || fallbackMessage,
          severity: 'error'
        };
        processError(userError);
      });
      return;
    }
    // Create a generic error for other cases
    else {
      userError = {
        code: 'UNKNOWN_ERROR',
        message: error?.message || fallbackMessage,
        severity: 'error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      };
    }

    processError(userError);
  }, [fallbackMessage, onError, showError, showNotification]);

  const processError = useCallback((userError: UserFriendlyError) => {
    setError(userError);
    setIsError(true);

    // Show notification if enabled
    if (showNotification) {
      showError(userError.message, userError.code, userError.severity || 'error');
    }

    // Call custom error handler if provided
    if (onError) {
      onError(userError);
    }
  }, [showNotification, showError, onError]);

  const clearError = useCallback(() => {
    setError(null);
    setIsError(false);
  }, []);

  // Helper function to wrap async API calls with error handling
  const withErrorHandling = useCallback(async <T,>(
    apiCall: () => Promise<T>
  ): Promise<T | null> => {
    try {
      clearError();
      const result = await apiCall();
      return result;
    } catch (error) {
      handleApiError(error);
      return null;
    }
  }, [clearError, handleApiError]);

  return {
    error,
    isError,
    handleApiError,
    clearError,
    withErrorHandling
  };
};

// Language detection helper
export const getUserLanguage = (): string => {
  // Check localStorage for saved preference
  const savedLang = localStorage.getItem('userLanguage');
  if (savedLang) return savedLang;

  // Check browser language
  const browserLang = navigator.language || navigator.languages?.[0];
  if (browserLang) {
    // Extract language code (e.g., 'en-US' -> 'en')
    return browserLang.split('-')[0];
  }

  return 'en';
};

// Set language preference
export const setUserLanguage = (language: string): void => {
  localStorage.setItem('userLanguage', language);
};