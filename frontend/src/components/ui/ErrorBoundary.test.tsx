import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <div>ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders the fallback instead of crashing the whole page when a child throws during render', () => {
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div data-testid="sibling">
        sibling content
        <ErrorBoundary fallback={<div>something went wrong</div>} onError={onError}>
          <Bomb />
        </ErrorBoundary>
      </div>
    );

    expect(screen.getByText('something went wrong')).toBeInTheDocument();
    // The boundary contains the crash -- an unrelated sibling subtree (e.g. the LiveKit
    // meeting tree in StudyRoom.tsx) stays mounted rather than being torn down with it.
    expect(screen.getByTestId('sibling')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything());

    consoleSpy.mockRestore();
  });
});
