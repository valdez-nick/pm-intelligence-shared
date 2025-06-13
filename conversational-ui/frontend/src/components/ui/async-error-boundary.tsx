import React, { useState, useEffect, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
  retryDelay?: number;
  maxRetries?: number;
  context?: string;
}

interface AsyncErrorState {
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
  isOnline: boolean;
}

/**
 * Specialized Error Boundary for handling async operations and API failures
 * 
 * Features:
 * - Handles Promise rejections and async errors
 * - Automatic retry mechanism with configurable attempts
 * - Network status detection and handling
 * - Graceful degradation for offline scenarios
 * - Context-aware error messages
 * - Loading states during retry operations
 */
export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({
  children,
  fallback,
  onError,
  retryDelay = 2000,
  maxRetries = 3,
  context = 'Operation',
}) => {
  const [state, setState] = useState<AsyncErrorState>({
    error: null,
    retryCount: 0,
    isRetrying: false,
    isOnline: navigator.onLine,
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      // Automatically retry if we were offline and had an error
      if (state.error && !state.isOnline) {
        handleRetry();
      }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      handleAsyncError(event.reason);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [state.error, state.isOnline]);

  const handleAsyncError = (error: unknown) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    setState(prev => ({
      ...prev,
      error: errorObj,
      isRetrying: false,
    }));

    if (onError) {
      onError(errorObj);
    }
  };

  const handleRetry = async () => {
    if (state.retryCount >= maxRetries) {
      return;
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, retryDelay));

    // Clear error to trigger re-render
    setState(prev => ({
      ...prev,
      error: null,
      isRetrying: false,
    }));
  };

  const handleReset = () => {
    setState({
      error: null,
      retryCount: 0,
      isRetrying: false,
      isOnline: navigator.onLine,
    });
  };

  const getErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase();

    if (!state.isOnline) {
      return `You're currently offline. Please check your internet connection and try again.`;
    }

    if (message.includes('fetch') || message.includes('network')) {
      return `Network error occurred while ${context.toLowerCase()}. Please check your connection and try again.`;
    }

    if (message.includes('timeout')) {
      return `${context} is taking longer than expected. Please try again.`;
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return `Authentication failed. Please refresh the page and try again.`;
    }

    if (message.includes('403') || message.includes('forbidden')) {
      return `You don't have permission to perform this action.`;
    }

    if (message.includes('404') || message.includes('not found')) {
      return `The requested resource was not found. It may have been moved or deleted.`;
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return `Too many requests. Please wait a moment before trying again.`;
    }

    if (message.includes('500') || message.includes('server error')) {
      return `Server error occurred. Our team has been notified. Please try again later.`;
    }

    return `An error occurred while ${context.toLowerCase()}. Please try again.`;
  };

  // If there's an error, render error UI
  if (state.error) {
    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback(state.error, handleRetry)}</>;
    }

    const errorMessage = getErrorMessage(state.error);
    const canRetry = state.retryCount < maxRetries;

    return (
      <div className="p-4">
        <Alert variant="destructive">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {state.isOnline ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <WifiOff className="h-5 w-5" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <AlertDescription className="space-y-3">
                <div>
                  <p className="font-medium">
                    {state.isOnline ? `${context} Failed` : 'Connection Lost'}
                  </p>
                  <p className="text-sm mt-1">{errorMessage}</p>
                </div>

                {/* Retry information */}
                {state.retryCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Retry attempt {state.retryCount} of {maxRetries}
                  </p>
                )}

                {/* Network status indicator */}
                <div className="flex items-center space-x-2 text-xs">
                  {state.isOnline ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-green-600">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-red-500" />
                      <span className="text-red-600">Offline</span>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {canRetry && (
                    <Button
                      size="sm"
                      onClick={handleRetry}
                      disabled={state.isRetrying || !state.isOnline}
                      className="h-8"
                    >
                      {state.isRetrying ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    className="h-8"
                  >
                    Reset
                  </Button>
                </div>

                {/* Max retries reached message */}
                {!canRetry && (
                  <p className="text-xs text-muted-foreground">
                    Maximum retry attempts reached. Please refresh the page or contact support if the problem persists.
                  </p>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  // If retrying, show loading state
  if (state.isRetrying) {
    return (
      <div className="p-4">
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Retrying {context.toLowerCase()}... (Attempt {state.retryCount} of {maxRetries})
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render children normally
  return <>{children}</>;
};

/**
 * Hook for handling async errors in functional components
 */
export function useAsyncError() {
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  const throwAsyncError = (error: Error) => {
    setAsyncError(error);
  };

  // Throw error to be caught by error boundary
  if (asyncError) {
    throw asyncError;
  }

  return throwAsyncError;
}

/**
 * Higher-order component for wrapping async operations
 */
export function withAsyncErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<AsyncErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AsyncErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AsyncErrorBoundary>
  );

  WrappedComponent.displayName = `withAsyncErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Utility function to wrap async operations with error handling
 */
export async function withAsyncErrorHandling<T>(
  operation: () => Promise<T>,
  onError?: (error: Error) => void,
  context?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    if (onError) {
      onError(errorObj);
    } else {
      console.error(`Async error in ${context}:`, errorObj);
    }
    
    return null;
  }
}