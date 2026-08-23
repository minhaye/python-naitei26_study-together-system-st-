import { describe, it, expect } from 'vitest';
import {
  emptyWhiteboardChanges,
  isEmptyWhiteboardChanges,
  mergeWhiteboardChanges,
  type WhiteboardChanges,
} from './whiteboardChangeBatch';

function record(id: string, extra: Record<string, unknown> = {}) {
  return { id, typeName: 'shape', ...extra } as any;
}

function changes(partial: Partial<WhiteboardChanges>): WhiteboardChanges {
  return { ...emptyWhiteboardChanges(), ...partial };
}

describe('isEmptyWhiteboardChanges', () => {
  it('is true for a fresh empty changes object', () => {
    expect(isEmptyWhiteboardChanges(emptyWhiteboardChanges())).toBe(true);
  });

  it('is false once any bucket has an entry', () => {
    expect(isEmptyWhiteboardChanges(changes({ added: { 'shape:a': record('shape:a') } }))).toBe(false);
  });
});

describe('mergeWhiteboardChanges', () => {
  it('keeps independent adds from separate batches', () => {
    const acc = changes({ added: { 'shape:a': record('shape:a') } });
    const next = changes({ added: { 'shape:b': record('shape:b') } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(Object.keys(merged.added).sort()).toEqual(['shape:a', 'shape:b']);
  });

  it('folds an update-after-add into the add, keeping the final value', () => {
    const v1 = record('shape:a', { x: 1 });
    const v2 = record('shape:a', { x: 2 });
    const acc = changes({ added: { 'shape:a': v1 } });
    const next = changes({ updated: { 'shape:a': [v1, v2] } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(merged.added['shape:a']).toEqual(v2);
    expect(merged.updated['shape:a']).toBeUndefined();
  });

  it('chains update-after-update, preserving the original "from" value', () => {
    const v1 = record('shape:a', { x: 1 });
    const v2 = record('shape:a', { x: 2 });
    const v3 = record('shape:a', { x: 3 });
    const acc = changes({ updated: { 'shape:a': [v1, v2] } });
    const next = changes({ updated: { 'shape:a': [v2, v3] } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(merged.updated['shape:a']).toEqual([v1, v3]);
  });

  it('cancels out an add-then-remove within the same batch window', () => {
    const acc = changes({ added: { 'shape:a': record('shape:a') } });
    const next = changes({ removed: { 'shape:a': record('shape:a') } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(merged.added['shape:a']).toBeUndefined();
    expect(merged.removed['shape:a']).toBeUndefined();
    expect(isEmptyWhiteboardChanges(merged)).toBe(true);
  });

  it('turns an update-then-remove into a plain remove', () => {
    const v1 = record('shape:a', { x: 1 });
    const v2 = record('shape:a', { x: 2 });
    const acc = changes({ updated: { 'shape:a': [v1, v2] } });
    const next = changes({ removed: { 'shape:a': v2 } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(merged.updated['shape:a']).toBeUndefined();
    expect(merged.removed['shape:a']).toEqual(v2);
  });

  it('turns a remove-then-add into a plain add with the latest value', () => {
    const removed = record('shape:a', { x: 1 });
    const readded = record('shape:a', { x: 9 });
    const acc = changes({ removed: { 'shape:a': removed } });
    const next = changes({ added: { 'shape:a': readded } });

    const merged = mergeWhiteboardChanges(acc, next);

    expect(merged.removed['shape:a']).toBeUndefined();
    expect(merged.added['shape:a']).toEqual(readded);
  });
});
