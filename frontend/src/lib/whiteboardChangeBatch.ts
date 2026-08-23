import type { TLRecord } from 'tldraw';

/** Same shape as tldraw's internal `RecordsDiff<TLRecord>` (store.listen's `update.changes`) --
 * kept as a local type rather than importing `@tldraw/store` directly, since only the
 * top-level `tldraw` package is a declared frontend dependency. */
export interface WhiteboardChanges {
  added: Record<string, TLRecord>;
  updated: Record<string, [from: TLRecord, to: TLRecord]>;
  removed: Record<string, TLRecord>;
}

export function emptyWhiteboardChanges(): WhiteboardChanges {
  return { added: {}, updated: {}, removed: {} };
}

export function isEmptyWhiteboardChanges(changes: WhiteboardChanges): boolean {
  return (
    Object.keys(changes.added).length === 0 &&
    Object.keys(changes.updated).length === 0 &&
    Object.keys(changes.removed).length === 0
  );
}

/**
 * Folds `next` into `acc`, preserving the net effect of applying both diffs in sequence --
 * used to batch many rapid tldraw store changes (e.g. every point of a freehand drag, which
 * can fire a store.listen callback every ~16ms) into a single LiveKit data-channel packet per
 * throttle window instead of one packet per change (see useWhiteboardSync.ts's flush timer).
 * Cuts network usage during high-frequency drawing without dropping any edit -- a record
 * added then updated within the same window still ends up in `added` (with the final value),
 * added then removed cancels out entirely, etc. Only the merged record's identity/keys matter
 * to the receiver (handleDataReceived only reads `Object.keys(removed)`, not their values), so
 * this doesn't need to be a byte-perfect reimplementation of tldraw's own diff semantics.
 */
export function mergeWhiteboardChanges(acc: WhiteboardChanges, next: WhiteboardChanges): WhiteboardChanges {
  const added = { ...acc.added };
  const updated = { ...acc.updated };
  const removed = { ...acc.removed };

  for (const [id, record] of Object.entries(next.added)) {
    if (id in removed) {
      delete removed[id];
      added[id] = record;
    } else if (id in updated) {
      updated[id] = [updated[id][0], record];
    } else {
      added[id] = record;
    }
  }

  for (const [id, pair] of Object.entries(next.updated)) {
    const to = pair[1];
    if (id in added) {
      added[id] = to;
    } else if (id in updated) {
      updated[id] = [updated[id][0], to];
    } else {
      updated[id] = pair;
    }
  }

  for (const [id, record] of Object.entries(next.removed)) {
    if (id in added) {
      delete added[id];
    } else if (id in updated) {
      delete updated[id];
      removed[id] = record;
    } else {
      removed[id] = record;
    }
  }

  return { added, updated, removed };
}
