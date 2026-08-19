import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches a render exception thrown by `children` and shows `fallback` in its place instead
 * of letting it propagate up and unmount unrelated siblings. Concretely: Study Room renders
 * its chat message list inside the same tree as `<LiveKitRoom>` (see StudyRoom.tsx's
 * `<MeetingProvider>` wrapping the whole page) -- a render crash from a malformed message
 * previously unmounted the entire LiveKit connection along with it, which looked to the user
 * like being kicked from the call. Pass a `key` that changes with the underlying data (e.g.
 * conversation id) so the boundary resets instead of showing the fallback forever. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
