/**
 * ErrorBoundary
 *
 * A class-based React error boundary that catches errors in the React
 * component tree and renders an appropriate fallback UI.
 *
 * - If the caught error is a `MissingIconError`, renders a "Startup Error"
 *   screen with the missing icon key name (Req 1.4).
 * - For all other errors, renders a generic "Something went wrong" screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { MissingIconError } from './IconRegistry';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component
 *
 * Catches errors during render, in lifecycle methods, and in constructors
 * of the whole tree below them. If a `MissingIconError` is caught, displays
 * a red startup error screen with the missing icon key.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console or an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;

      // Special handling for MissingIconError (Req 1.4)
      if (error instanceof MissingIconError) {
        return (
          <View style={styles.startupErrorContainer}>
            <View style={styles.startupErrorBox}>
              <Text style={styles.startupErrorTitle}>App cannot start</Text>
              <Text style={styles.startupErrorMessage}>
                A required icon asset is missing:
              </Text>
              <Text style={styles.startupErrorKey}>"{error.key}"</Text>
              <Text style={styles.startupErrorHint}>
                Please contact support or reinstall the app.
              </Text>
            </View>
          </View>
        );
      }

      // Generic error fallback for all other errors
      return (
        <View style={styles.genericErrorContainer}>
          <View style={styles.genericErrorBox}>
            <Text style={styles.genericErrorTitle}>Something went wrong</Text>
            <Text style={styles.genericErrorMessage}>
              An unexpected error occurred. Please restart the app.
            </Text>
            <Text style={styles.genericErrorDetails}>{error.message}</Text>
          </View>
        </View>
      );
    }

    // No error: render children normally
    return this.props.children;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Startup error (MissingIconError) styles — red background
  startupErrorContainer: {
    flex: 1,
    backgroundColor: '#f44336', // red
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  startupErrorBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    maxWidth: 400,
    alignItems: 'center',
  },
  startupErrorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  startupErrorMessage: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  startupErrorKey: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  startupErrorHint: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },

  // Generic error fallback styles — neutral colors
  genericErrorContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  genericErrorBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  genericErrorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#424242',
    marginBottom: 12,
    textAlign: 'center',
  },
  genericErrorMessage: {
    fontSize: 16,
    color: '#616161',
    marginBottom: 16,
    textAlign: 'center',
  },
  genericErrorDetails: {
    fontSize: 14,
    color: '#9e9e9e',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
