"use client";

import { Component, ReactNode, ErrorInfo } from 'react';
import { debugLogger } from '@/utils/debug-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class HydrationBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    debugLogger.error('HydrationBoundary', 'Hydration error caught', {
      error: error.message,
      stack: error.stack,
      timestamp: performance.now()
    });
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLogger.error('HydrationBoundary', 'Component catch details', {
      error: error.message,
      errorInfo: errorInfo.componentStack,
      timestamp: performance.now()
    });
  }

  componentDidMount() {
    // Reset error state after successful mount
    if (this.state.hasError) {
      debugLogger.log('HydrationBoundary', 'Attempting recovery after hydration error', {
        timestamp: performance.now()
      });
      
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="hydration-error">
          <p>Hydration error occurred. Retrying...</p>
        </div>
      );
    }

    return this.props.children;
  }
}