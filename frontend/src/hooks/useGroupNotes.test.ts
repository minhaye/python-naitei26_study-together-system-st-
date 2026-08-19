import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/apiClient';
import { useAuth } from './useAuth';
import { createNote, deleteNote, listGroupNotes, updateNote } from '../lib/note.api';
import { NOTE_CONTENT_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../lib/note.types';
import { useGroupNotes } from './useGroupNotes';
import type { Note } from '../lib/note.types';

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/note.api', () => ({
  listGroupNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedList = vi.mocked(listGroupNotes);
const mockedCreate = vi.mocked(createNote);
const mockedUpdate = vi.mocked(updateNote);
const mockedDelete = vi.mocked(deleteNote);

const author = { id: 'user-1', username: 'alice', display_name: 'Alice', avatar_url: null };

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    group_id: 'group-1',
    author_id: 'user-1',
    title: null,
    content: 'Hello note',
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    author,
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    isLoggedIn: true,
    user: { id: 'user-1' },
  } as unknown as ReturnType<typeof useAuth>);
  mockedList.mockReset();
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
  mockedDelete.mockReset();
});

describe('useGroupNotes', () => {
  it('loads notes for the group on mount, in chronological order', async () => {
    mockedList.mockResolvedValue([
      makeNote({ id: 'note-2', created_at: '2026-08-19T01:00:00Z' }),
      makeNote({ id: 'note-1', created_at: '2026-08-19T00:00:00Z' }),
    ]);

    const { result } = renderHook(() => useGroupNotes('group-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedList).toHaveBeenCalledWith('group-1');
    expect(result.current.notes.map((n) => n.id)).toEqual(['note-1', 'note-2']);
    expect(result.current.listError).toBeNull();
    expect(result.current.focusedIndex).toBe(0);
    expect(result.current.focusedNote?.id).toBe('note-1');
  });

  it('surfaces an empty list distinctly from an error, with no focused note', async () => {
    mockedList.mockResolvedValue([]);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notes).toEqual([]);
    expect(result.current.listError).toBeNull();
    expect(result.current.focusedNote).toBeUndefined();
  });

  it('surfaces an API error from the list call', async () => {
    mockedList.mockRejectedValue(new ApiError(500, 'Server error'));

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notes).toEqual([]);
    expect(result.current.listError).toEqual({ status: 500, message: 'Server error' });
  });

  // --- navigation ---

  it('navigates Previous/Next and clamps at both boundaries', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' }), makeNote({ id: 'b' }), makeNote({ id: 'c' })]);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(3));

    expect(result.current.focusedIndex).toBe(0);
    act(() => result.current.goToPrev()); // already at first -- no-op
    expect(result.current.focusedIndex).toBe(0);

    act(() => result.current.goToNext());
    expect(result.current.focusedIndex).toBe(1);
    act(() => result.current.goToNext());
    expect(result.current.focusedIndex).toBe(2);
    act(() => result.current.goToNext()); // already at last -- no-op
    expect(result.current.focusedIndex).toBe(2);

    act(() => result.current.goToPrev());
    expect(result.current.focusedIndex).toBe(1);
  });

  // --- create ---

  it('creates a note, appends it, and auto-focuses it', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' })]);
    const created = makeNote({ id: 'b', content: 'New note', created_at: '2026-08-19T02:00:00Z' });
    mockedCreate.mockResolvedValue(created);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    act(() => result.current.startAdd());
    act(() => result.current.setNewContent('New note'));
    await act(async () => {
      await result.current.submitCreate();
    });

    expect(mockedCreate).toHaveBeenCalledWith({ group_id: 'group-1', title: null, content: 'New note' });
    expect(result.current.notes.map((n) => n.id)).toEqual(['a', 'b']);
    await waitFor(() => expect(result.current.focusedNote?.id).toBe('b'));
    expect(result.current.isAdding).toBe(false);
    expect(result.current.isCreating).toBe(false);
    expect(result.current.createError).toBeNull();
  });

  it('ignores a second create call while one is already in flight', async () => {
    mockedList.mockResolvedValue([]);
    let resolveCreate!: (note: Note) => void;
    mockedCreate.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setNewContent('A'));
    let firstCreate!: Promise<Note | undefined>;
    act(() => {
      firstCreate = result.current.submitCreate();
      result.current.submitCreate(); // should be a no-op, create already in flight
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);

    resolveCreate(makeNote());
    await act(async () => {
      await firstCreate;
    });
  });

  it('surfaces a create failure without adding a note, keeping the composer open', async () => {
    mockedList.mockResolvedValue([]);
    mockedCreate.mockRejectedValue(new ApiError(403, 'Forbidden'));

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.startAdd());
    act(() => result.current.setNewContent('x'));
    await act(async () => {
      await expect(result.current.submitCreate()).rejects.toThrow();
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.createError).toEqual({ status: 403, message: 'Forbidden' });
    expect(result.current.isAdding).toBe(true); // composer stays open to retry
  });

  it('truncates title/content drafts to the backend-authoritative max lengths', async () => {
    mockedList.mockResolvedValue([]);
    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setNewTitle('x'.repeat(NOTE_TITLE_MAX_LENGTH + 50)));
    act(() => result.current.setNewContent('y'.repeat(NOTE_CONTENT_MAX_LENGTH + 500)));

    expect(result.current.newTitle).toHaveLength(NOTE_TITLE_MAX_LENGTH);
    expect(result.current.newContent).toHaveLength(NOTE_CONTENT_MAX_LENGTH);
  });

  // --- edit ---

  it('edits the focused note in place, keeping it focused', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a', content: 'Old' })]);
    const updated = makeNote({ id: 'a', content: 'Edited' });
    mockedUpdate.mockResolvedValue(updated);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    act(() => result.current.startEdit());
    expect(result.current.editingContent).toBe('Old');
    act(() => result.current.setEditingContent('Edited'));
    await act(async () => {
      await result.current.submitEdit();
    });

    expect(mockedUpdate).toHaveBeenCalledWith('a', { title: null, content: 'Edited' });
    expect(result.current.focusedNote?.content).toBe('Edited');
    expect(result.current.focusedIndex).toBe(0);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editError).toBeNull();
  });

  it('keeps the note unchanged and stays in editing mode when edit fails', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a', content: 'Old' })]);
    mockedUpdate.mockRejectedValue(new ApiError(403, 'Forbidden'));

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    act(() => result.current.startEdit());
    act(() => result.current.setEditingContent('Edited'));
    await act(async () => {
      await expect(result.current.submitEdit()).rejects.toThrow();
    });

    expect(result.current.focusedNote?.content).toBe('Old');
    expect(result.current.editError).toEqual({ status: 403, message: 'Forbidden' });
    expect(result.current.isEditing).toBe(true); // stays open so the user can retry
  });

  it('ignores a duplicate edit submit while one is in flight', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' })]);
    let resolveUpdate!: (note: Note) => void;
    mockedUpdate.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    act(() => result.current.startEdit());
    act(() => result.current.setEditingContent('A'));
    let firstEdit!: Promise<Note | undefined>;
    act(() => {
      firstEdit = result.current.submitEdit();
      result.current.submitEdit(); // duplicate -> no-op
    });

    expect(mockedUpdate).toHaveBeenCalledTimes(1);

    resolveUpdate(makeNote({ content: 'A' }));
    await act(async () => {
      await firstEdit;
    });
  });

  // --- delete ---

  it('deletes the last-focused note and steps back to the new last note', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' }), makeNote({ id: 'b' }), makeNote({ id: 'c' })]);
    mockedDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(3));

    act(() => result.current.goToNext());
    act(() => result.current.goToNext());
    expect(result.current.focusedNote?.id).toBe('c');

    await act(async () => {
      await result.current.submitDelete();
    });

    expect(mockedDelete).toHaveBeenCalledWith('c');
    expect(result.current.notes.map((n) => n.id)).toEqual(['a', 'b']);
    await waitFor(() => expect(result.current.focusedNote?.id).toBe('b'));
  });

  it('deleting a non-last focused note lands on the note that shifted into its place', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' }), makeNote({ id: 'b' }), makeNote({ id: 'c' })]);
    mockedDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(3));

    expect(result.current.focusedNote?.id).toBe('a'); // index 0, not last

    await act(async () => {
      await result.current.submitDelete();
    });

    expect(mockedDelete).toHaveBeenCalledWith('a');
    expect(result.current.notes.map((n) => n.id)).toEqual(['b', 'c']);
    await waitFor(() => expect(result.current.focusedIndex).toBe(0));
    expect(result.current.focusedNote?.id).toBe('b');
  });

  it('deleting the only remaining note produces the empty state', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' })]);
    mockedDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    await act(async () => {
      await result.current.submitDelete();
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.focusedNote).toBeUndefined();
  });

  it('keeps the note in the list when delete fails', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' })]);
    mockedDelete.mockRejectedValue(new ApiError(403, 'Forbidden'));

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    await act(async () => {
      await expect(result.current.submitDelete()).rejects.toThrow();
    });

    expect(result.current.notes).toHaveLength(1);
    expect(result.current.deleteError).toEqual({ status: 403, message: 'Forbidden' });
  });

  it('ignores a duplicate delete submit on the same note while one is in flight', async () => {
    mockedList.mockResolvedValue([makeNote({ id: 'a' })]);
    let resolveDelete!: () => void;
    mockedDelete.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      })
    );

    const { result } = renderHook(() => useGroupNotes('group-1'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    let firstDelete!: Promise<void>;
    act(() => {
      firstDelete = result.current.submitDelete();
      result.current.submitDelete(); // duplicate -> no-op
    });

    await waitFor(() => expect(result.current.isDeletingFocused).toBe(true));
    expect(mockedDelete).toHaveBeenCalledTimes(1);

    resolveDelete();
    await act(async () => {
      await firstDelete;
    });

    expect(result.current.isDeletingFocused).toBe(false);
  });
});
