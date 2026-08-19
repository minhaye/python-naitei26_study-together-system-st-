import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { ApiError } from '../lib/apiClient';
import { createNote, deleteNote, listGroupNotes, updateNote } from '../lib/note.api';
import { NOTE_CONTENT_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../lib/note.types';
import type { Note } from '../lib/note.types';

export interface NoteError {
  status: number | null;
  message: string;
}

function toNoteError(err: unknown): NoteError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Đã xảy ra lỗi không xác định.' };
}

/**
 * Group Notes: shared content maintained by the Group Owner/Moderator (see note_router.py) --
 * mutation authority is not author-based, so the caller must gate create/edit/delete UI on
 * the real `isGroupManager` flag (from StudyGroupDetail); the backend independently rejects
 * the mutation for anyone else regardless of what the UI shows (see NotesStackPanel).
 *
 * Owns the full paper-stack UI state (focused index, composer/editor drafts) in addition to
 * data fetching/mutation, so the presentational panel only renders JSX from these values.
 */
export function useGroupNotes(groupId: string | undefined) {
  const { isLoggedIn } = useAuth();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<NoteError | null>(null);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitleState] = useState('');
  const [newContent, setNewContentState] = useState('');
  const [createError, setCreateError] = useState<NoteError | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitleState] = useState('');
  const [editingContent, setEditingContentState] = useState('');
  const [editError, setEditError] = useState<NoteError | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<NoteError | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Guards against a second mutation firing while one is already in flight (e.g. a fast
  // double-click), independent of the render-visible pending state.
  const createInFlight = useRef(false);
  const editInFlight = useRef<Set<string>>(new Set());
  const deleteInFlight = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!groupId || !isLoggedIn) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const data = await listGroupNotes(groupId);
      setNotes(data);
    } catch (err) {
      setNotes([]);
      setListError(toNoteError(err));
    } finally {
      setLoading(false);
    }
  }, [groupId, isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  // Stable deterministic order: chronological (created_at ascending), matching the backend's
  // NotesService.list_by_group -- the paper-stack UI navigates this as a fixed sequence.
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [notes]
  );

  // Keeps the focused index valid whenever the note count changes -- e.g. after a delete
  // shrinks the array, this clamps down to the nearest remaining note (never an out-of-bounds
  // index, never left pointing at nothing if the list becomes empty).
  useEffect(() => {
    setFocusedIndex((prev) => (sortedNotes.length === 0 ? 0 : Math.min(prev, sortedNotes.length - 1)));
  }, [sortedNotes.length]);

  // Once a just-created note appears in the (now re-sorted) list, focus it. Resolving by id
  // rather than a computed index avoids any stale-closure ordering issues with the two
  // separate state updates (notes list, focus) that a create triggers.
  useEffect(() => {
    if (!pendingFocusNoteId) return;
    const idx = sortedNotes.findIndex((n) => n.id === pendingFocusNoteId);
    if (idx !== -1) {
      setFocusedIndex(idx);
      setPendingFocusNoteId(null);
    }
  }, [pendingFocusNoteId, sortedNotes]);

  const focusedNote: Note | undefined = sortedNotes[focusedIndex];

  const setNewTitle = useCallback((value: string) => setNewTitleState(value.slice(0, NOTE_TITLE_MAX_LENGTH)), []);
  const setNewContent = useCallback((value: string) => setNewContentState(value.slice(0, NOTE_CONTENT_MAX_LENGTH)), []);
  const setEditingTitle = useCallback(
    (value: string) => setEditingTitleState(value.slice(0, NOTE_TITLE_MAX_LENGTH)),
    []
  );
  const setEditingContent = useCallback(
    (value: string) => setEditingContentState(value.slice(0, NOTE_CONTENT_MAX_LENGTH)),
    []
  );

  const startAdd = useCallback(() => {
    setIsEditing(false);
    setNewTitleState('');
    setNewContentState('');
    setCreateError(null);
    setIsAdding(true);
  }, []);

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewTitleState('');
    setNewContentState('');
    setCreateError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!groupId || !newContent.trim() || createInFlight.current) return;
    createInFlight.current = true;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createNote({ group_id: groupId, title: newTitle.trim() || null, content: newContent.trim() });
      setNotes((prev) => [...prev, created]);
      setPendingFocusNoteId(created.id);
      setIsAdding(false);
      setNewTitleState('');
      setNewContentState('');
      return created;
    } catch (err) {
      setCreateError(toNoteError(err));
      throw err;
    } finally {
      createInFlight.current = false;
      setIsCreating(false);
    }
  }, [groupId, newTitle, newContent]);

  const startEdit = useCallback(() => {
    if (!focusedNote) return;
    setIsAdding(false);
    setEditingTitleState(focusedNote.title ?? '');
    setEditingContentState(focusedNote.content);
    setEditError(null);
    setIsEditing(true);
  }, [focusedNote]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditError(null);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!focusedNote || !editingContent.trim() || editInFlight.current.has(focusedNote.id)) return;
    const noteId = focusedNote.id;
    editInFlight.current.add(noteId);
    setPendingEditId(noteId);
    setEditError(null);
    try {
      const updated = await updateNote(noteId, { title: editingTitle.trim() || null, content: editingContent.trim() });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setIsEditing(false);
      return updated;
    } catch (err) {
      setEditError(toNoteError(err));
      throw err;
    } finally {
      editInFlight.current.delete(noteId);
      setPendingEditId(null);
    }
  }, [focusedNote, editingTitle, editingContent]);

  const submitDelete = useCallback(async () => {
    if (!focusedNote || deleteInFlight.current.has(focusedNote.id)) return;
    const noteId = focusedNote.id;
    deleteInFlight.current.add(noteId);
    setPendingDeleteId(noteId);
    setDeleteError(null);
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      setDeleteError(toNoteError(err));
      throw err;
    } finally {
      deleteInFlight.current.delete(noteId);
      setPendingDeleteId(null);
    }
  }, [focusedNote]);

  const goToPrev = useCallback(() => setFocusedIndex((i) => Math.max(0, i - 1)), []);
  const goToNext = useCallback(
    () => setFocusedIndex((i) => Math.min(sortedNotes.length - 1, i + 1)),
    [sortedNotes.length]
  );

  return {
    notes: sortedNotes,
    loading,
    listError,
    refetch: load,

    focusedIndex,
    focusedNote: focusedNote as Note | undefined,
    goToPrev,
    goToNext,

    isAdding,
    newTitle,
    newContent,
    setNewTitle,
    setNewContent,
    createError,
    isCreating,
    startAdd,
    cancelAdd,
    submitCreate,

    isEditing,
    editingTitle,
    editingContent,
    setEditingTitle,
    setEditingContent,
    editError,
    isSavingFocused: !!focusedNote && pendingEditId === focusedNote.id,
    startEdit,
    cancelEdit,
    submitEdit,

    deleteError,
    isDeletingFocused: !!focusedNote && pendingDeleteId === focusedNote.id,
    submitDelete,
  };
}

export type GroupNotesController = ReturnType<typeof useGroupNotes>;
