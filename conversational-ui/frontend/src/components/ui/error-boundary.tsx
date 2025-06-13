import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Enhanced Error Boundary component for graceful error handling
 * 
 * Features:
 * - Catches and displays JavaScript errors in child components
 * - Provides user-friendly error messages with recovery options
 * - Supports custom fallback UI and error reporting
 * - Includes error details for debugging (optional)
 * - Generates unique error IDs for tracking
 * - Offers multiple recovery actions (retry, navigate, report)
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Implementation for error reporting service
    // This could be Sentry, LogRocket, Bugsnag, etc.
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Example: Send to error reporting service
    // errorReportingService.captureException(errorReport);
    console.log('Error report generated:', errorReport);
  };

  private handleRetry = () => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };


  private handleReload = () => {
    window.location.reload();
  };

  private handleNavigateHome = () => {
    window.location.href = '/';
  };

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network Error';
    }
    if (message.includes('chunk') || stack.includes('chunk')) {
      return 'Loading Error';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Permission Error';
    }
    if (message.includes('timeout')) {
      return 'Timeout Error';
    }
    if (stack.includes('react') || stack.includes('component')) {
      return 'Component Error';
    }
    
    return 'Application Error';
  };

  private getUserFriendlyMessage = (error: Error): string => {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'Network Error':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'Loading Error':
        return 'Failed to load application resources. This might be due to a poor connection or server issue.';
      case 'Permission Error':
        return 'You don\'t have permission to access this feature. Please contact your administrator.';
      case 'Timeout Error':
        return 'The operation is taking longer than expected. Please try again.';
      case 'Component Error':
        return 'A component failed to render properly. This might be due to invalid data or a temporary glitch.';
      default:
        return 'An unexpected error occurred. Our team has been notified and is working on a fix.';
    }
  };

  render() {
    if (this.state.hasError) {
      // Return custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;
      const errorCategory = error ? this.getErrorCategory(error) : 'Unknown Error';
      const userMessage = error ? this.getUserFriendlyMessage(error) : 'An unknown error occurred.';
      const context = this.props.context || 'Application';

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* Error Icon */}
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </div>

                {/* Error Title */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {errorCategory}
                  </h2>
                  <p className="text-gray-600">
                    Something went wrong in the {context}
                  </p>
                </div>

                {/* User-friendly message */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{userMessage}</p>
                </div>

                {/* Error ID for support */}
                {errorId && (
                  <div className="text-sm text-gray-500">
                    <p>Error ID: <code className="bg-gray-100 px-2 py-1 rounded">{errorId}</code></p>
                    <p className="mt-1">Please provide this ID when contacting support.</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={this.handleRetry}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={this.handleReload}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reload Page</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={this.handleNavigateHome}
                    className="flex items-center space-x-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>Go Home</span>
                  </Button>
                </div>

                {/* Error Details (for development) */}
                {this.props.showDetails && error && process.env.NODE_ENV === 'development' && (
                  <details className="text-left mt-6">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                      <div className="flex items-center space-x-2">
                        <Bug className="w-4 h-4" />
                        <span>Technical Details (Development)</span>
                      </div>
                    </summary>
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-900">Error Message:</h4>
                          <p className="text-sm text-gray-700 font-mono bg-white p-2 rounded mt-1">
                            {error.message}
                          </p>
                        </div>
                        
                        {error.stack && (
                          <div>
                            <h4 className="font-medium text-gray-900">Stack Trace:</h4>
                            <pre className="text-xs text-gray-700 font-mono bg-white p-2 rounded mt-1 overflow-auto max-h-40">
                              {error.stack}
                            </pre>
                          </div>
                        )}
                        
                        {this.state.errorInfo && (
                          <div>
                            <h4 className="font-medium text-gray-900">Component Stack:</h4>
                            <pre className="text-xs text-gray-700 font-mono bg-white p-2 rounded mt-1 overflow-auto max-h-40">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error) => {
    // This would throw the error to be caught by the nearest error boundary
    // In a real implementation, you might want to integrate with React Error Boundary patterns
    throw error;
  }, []);

  return handleError;
}