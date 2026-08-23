import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesStackPanel, type NotesStackPanelProps } from './NotesStackPanel';
import type { Note } from '../../lib/note.types';

const author = { id: 'user-1', username: 'alice', display_name: 'Alice', avatar_url: null, role: 'user' as const };

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

function baseController(overrides: Partial<NotesStackPanelProps> = {}): NotesStackPanelProps {
  return {
    notes: [],
    loading: false,
    listError: null,
    refetch: vi.fn(),

    focusedIndex: 0,
    focusedNote: undefined,
    goToPrev: vi.fn(),
    goToNext: vi.fn(),

    isAdding: false,
    newTitle: '',
    newContent: '',
    setNewTitle: vi.fn(),
    setNewContent: vi.fn(),
    createError: null,
    isCreating: false,
    startAdd: vi.fn(),
    cancelAdd: vi.fn(),
    submitCreate: vi.fn(),

    isEditing: false,
    editingTitle: '',
    editingContent: '',
    setEditingTitle: vi.fn(),
    setEditingContent: vi.fn(),
    editError: null,
    isSavingFocused: false,
    startEdit: vi.fn(),
    cancelEdit: vi.fn(),
    submitEdit: vi.fn(),

    deleteError: null,
    isDeletingFocused: false,
    submitDelete: vi.fn(),

    isGroupManager: false,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<NotesStackPanelProps> = {}) {
  const props = baseController(overrides);
  render(<NotesStackPanel {...props} />);
  return props;
}

describe('NotesStackPanel', () => {
  it('shows a loading state', () => {
    renderPanel({ loading: true });
    expect(screen.getByText('Đang tải ghi chú...')).toBeInTheDocument();
  });

  describe('empty state', () => {
    it('Owner/Moderator sees an empty state with a Create note action', () => {
      renderPanel({ notes: [], isGroupManager: true });
      expect(screen.getByText('Chưa có ghi chú nào trong nhóm này.')).toBeInTheDocument();
      expect(screen.getByText('Tạo ghi chú')).toBeInTheDocument();
    });

    it('Member sees an empty state with no create action', () => {
      renderPanel({ notes: [], isGroupManager: false });
      expect(screen.getByText('Chưa có ghi chú nào được thêm vào nhóm này.')).toBeInTheDocument();
      expect(screen.queryByText('Tạo ghi chú')).not.toBeInTheDocument();
    });
  });

  describe('role-gated controls on the focused note', () => {
    const notes = [makeNote({ id: 'a' })];

    it('Member sees a read-only stack: no create/edit/delete controls, but can navigate', () => {
      renderPanel({ notes, focusedIndex: 0, focusedNote: notes[0], isGroupManager: false });
      expect(screen.queryByTitle('Tạo ghi chú')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Sửa')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Xóa')).not.toBeInTheDocument();
      expect(screen.getByTitle('Ghi chú trước')).toBeInTheDocument();
      expect(screen.getByTitle('Ghi chú sau')).toBeInTheDocument();
    });

    it('Owner/Moderator sees create/edit/delete controls', () => {
      renderPanel({ notes, focusedIndex: 0, focusedNote: notes[0], isGroupManager: true });
      expect(screen.getByTitle('Tạo ghi chú')).toBeInTheDocument();
      expect(screen.getByTitle('Sửa')).toBeInTheDocument();
      expect(screen.getByTitle('Xóa')).toBeInTheDocument();
    });
  });

  describe('stack navigation', () => {
    const notes = [makeNote({ id: 'a' }), makeNote({ id: 'b' }), makeNote({ id: 'c' })];

    it('shows the position indicator', () => {
      renderPanel({ notes, focusedIndex: 1, focusedNote: notes[1] });
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('disables Previous on the first note and Next on the last note', () => {
      const { rerender } = render(
        <NotesStackPanel {...baseController({ notes, focusedIndex: 0, focusedNote: notes[0] })} />
      );
      expect(screen.getByTitle('Ghi chú trước')).toBeDisabled();
      expect(screen.getByTitle('Ghi chú sau')).not.toBeDisabled();

      rerender(<NotesStackPanel {...baseController({ notes, focusedIndex: 2, focusedNote: notes[2] })} />);
      expect(screen.getByTitle('Ghi chú trước')).not.toBeDisabled();
      expect(screen.getByTitle('Ghi chú sau')).toBeDisabled();
    });

    it('calls goToPrev/goToNext on click', () => {
      const props = renderPanel({ notes, focusedIndex: 1, focusedNote: notes[1] });
      fireEvent.click(screen.getByTitle('Ghi chú trước'));
      fireEvent.click(screen.getByTitle('Ghi chú sau'));
      expect(props.goToPrev).toHaveBeenCalledTimes(1);
      expect(props.goToNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('composer (create)', () => {
    it('shows a content character counter and calls submitCreate', () => {
      const props = renderPanel({ isAdding: true, isGroupManager: true, newContent: 'hello' });
      expect(screen.getByText('5 / 2000')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Lưu'));
      expect(props.submitCreate).toHaveBeenCalledTimes(1);
    });

    it('disables Save while empty or pending', () => {
      renderPanel({ isAdding: true, newContent: '' });
      expect(screen.getByText('Lưu')).toBeDisabled();

      renderPanel({ isAdding: true, newContent: 'x', isCreating: true });
      expect(screen.getByText('Đang lưu...')).toBeDisabled();
    });

    it('surfaces a create error', () => {
      renderPanel({ isAdding: true, createError: { status: 403, message: 'Forbidden' } });
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });

  describe('editor (edit current note)', () => {
    const notes = [makeNote({ id: 'a', content: 'Old content' })];

    it('shows a content character counter for the editing draft', () => {
      renderPanel({
        notes,
        focusedIndex: 0,
        focusedNote: notes[0],
        isEditing: true,
        editingContent: 'Edited content',
        isGroupManager: true,
      });
      expect(screen.getByText('14 / 2000')).toBeInTheDocument();
    });

    it('disables Save while pending', () => {
      renderPanel({
        notes,
        focusedIndex: 0,
        focusedNote: notes[0],
        isEditing: true,
        editingContent: 'x',
        isSavingFocused: true,
      });
      expect(screen.getByTitle('Lưu')).toBeDisabled();
    });

    it('surfaces an edit error', () => {
      renderPanel({
        notes,
        focusedIndex: 0,
        focusedNote: notes[0],
        isEditing: true,
        editingContent: 'x',
        editError: { status: 403, message: 'Forbidden' },
      });
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    const notes = [makeNote({ id: 'a' })];

    it('disables the delete button while pending', () => {
      renderPanel({ notes, focusedIndex: 0, focusedNote: notes[0], isGroupManager: true, isDeletingFocused: true });
      expect(screen.getByTitle('Xóa')).toBeDisabled();
    });

    it('surfaces a delete error', () => {
      renderPanel({
        notes,
        focusedIndex: 0,
        focusedNote: notes[0],
        isGroupManager: true,
        deleteError: { status: 403, message: 'Forbidden' },
      });
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });
});
