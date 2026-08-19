import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { getDisplayName } from '../../utils/userDisplay';
import { NOTE_CONTENT_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../../lib/note.types';
import type { GroupNotesController } from '../../hooks/useGroupNotes';

export interface NotesStackPanelProps extends GroupNotesController {
  /** Notes are shared Group content maintained by the Group Owner/Moderator, never by note
   * authorship (see note_router.py) -- create/edit/delete controls are gated on this alone.
   * The backend independently rejects the mutation for anyone else regardless of this flag. */
  isGroupManager: boolean;
}

/** Light "sticky note" theme -- matches the announcement banner this panel replaces in the
 * Group sidebar (see StudyGroupDetail.tsx), not StudyRoom's dark theme (Notes no longer
 * appears there). */
const cardStyle: React.CSSProperties = {
  background: '#F0F9FF',
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid #BAE6FD',
  borderLeft: '4px solid #0284C7',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #7DD3FC',
  borderRadius: 6,
  color: '#0F172A',
  fontSize: 12.5,
  padding: '6px 8px',
  outline: 'none',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' };

const errorStyle: React.CSSProperties = { color: '#B91C1C', fontSize: 12 };

const counterStyle: React.CSSProperties = { textAlign: 'right', color: '#64748B', fontSize: 11 };

const iconButtonStyle = (disabled: boolean, color: string): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  color,
  cursor: disabled ? 'default' : 'pointer',
  padding: 4,
  display: 'flex',
  opacity: disabled ? 0.5 : 1,
});

export function NotesStackPanel({
  notes,
  loading,
  listError,
  focusedIndex,
  focusedNote,
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
  isSavingFocused,
  startEdit,
  cancelEdit,
  submitEdit,
  deleteError,
  isDeletingFocused,
  submitDelete,
  isGroupManager,
}: NotesStackPanelProps) {
  return (
    <div style={{ margin: '12px 12px 4px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: '700', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Ghi chú
        </span>
        {isGroupManager && !isAdding && !isEditing && notes.length > 0 && (
          <button onClick={startAdd} title="Tạo ghi chú" style={{ background: 'transparent', border: 'none', color: '#0284C7', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Plus size={16} />
          </button>
        )}
      </div>

      {listError && <div style={errorStyle}>{listError.message}</div>}

      {loading ? (
        <div style={{ color: '#64748B', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>Đang tải ghi chú...</div>
      ) : isAdding ? (
        <div style={cardStyle}>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={NOTE_TITLE_MAX_LENGTH}
            placeholder="Tiêu đề (không bắt buộc)"
            style={inputStyle}
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            maxLength={NOTE_CONTENT_MAX_LENGTH}
            placeholder="Nhập nội dung ghi chú..."
            rows={4}
            style={textareaStyle}
          />
          <div style={counterStyle}>
            {newContent.length} / {NOTE_CONTENT_MAX_LENGTH}
          </div>
          {createError && <div style={errorStyle}>{createError.message}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={cancelAdd}
              style={{ background: 'transparent', border: '1px solid #CBD5E1', color: '#64748B', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              Hủy
            </button>
            <button
              onClick={submitCreate}
              disabled={isCreating || !newContent.trim()}
              style={{
                background: '#0284C7',
                border: 'none',
                color: 'white',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: '600',
                cursor: isCreating || !newContent.trim() ? 'default' : 'pointer',
                opacity: isCreating || !newContent.trim() ? 0.6 : 1,
              }}
            >
              {isCreating ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div style={{ color: '#64748B', fontSize: 12.5, textAlign: 'center', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div>
            {isGroupManager ? 'Chưa có ghi chú nào trong nhóm này.' : 'Chưa có ghi chú nào được thêm vào nhóm này.'}
          </div>
          {isGroupManager && (
            <button
              onClick={startAdd}
              style={{ background: '#0284C7', border: 'none', color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={13} /> Tạo ghi chú
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            {notes.length > 1 && (
              <div
                aria-hidden
                style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 8, zIndex: 0 }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1, minHeight: 90, ...cardStyle }}>
              {isEditing ? (
                <>
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    maxLength={NOTE_TITLE_MAX_LENGTH}
                    placeholder="Tiêu đề (không bắt buộc)"
                    style={inputStyle}
                  />
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    maxLength={NOTE_CONTENT_MAX_LENGTH}
                    rows={4}
                    style={textareaStyle}
                  />
                  <div style={counterStyle}>
                    {editingContent.length} / {NOTE_CONTENT_MAX_LENGTH}
                  </div>
                  {editError && <div style={errorStyle}>{editError.message}</div>}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={cancelEdit} title="Hủy" style={iconButtonStyle(false, '#64748B')}>
                      <X size={14} />
                    </button>
                    <button
                      onClick={submitEdit}
                      disabled={isSavingFocused || !editingContent.trim()}
                      title="Lưu"
                      style={iconButtonStyle(isSavingFocused, '#0284C7')}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </>
              ) : (
                focusedNote && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#0369A1', fontSize: 11, fontWeight: '600' }}>{getDisplayName(focusedNote.author)}</span>
                      <span style={{ color: '#64748B', fontSize: 10, whiteSpace: 'nowrap' }}>
                        {new Date(focusedNote.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {focusedNote.title && <div style={{ color: '#0F172A', fontSize: 13, fontWeight: '700' }}>{focusedNote.title}</div>}
                    <div style={{ color: '#0F172A', fontSize: 12.5, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{focusedNote.content}</div>
                    {isGroupManager && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={startEdit} title="Sửa" style={iconButtonStyle(false, '#64748B')}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={submitDelete} disabled={isDeletingFocused} title="Xóa" style={iconButtonStyle(isDeletingFocused, '#DC2626')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          </div>

          {!isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={goToPrev}
                disabled={focusedIndex === 0}
                title="Ghi chú trước"
                style={{ ...iconButtonStyle(focusedIndex === 0, '#64748B'), gap: 2, fontSize: 11 }}
              >
                <ChevronLeft size={13} /> Trước
              </button>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>
                {focusedIndex + 1} / {notes.length}
              </span>
              <button
                onClick={goToNext}
                disabled={focusedIndex >= notes.length - 1}
                title="Ghi chú sau"
                style={{ ...iconButtonStyle(focusedIndex >= notes.length - 1, '#64748B'), gap: 2, fontSize: 11 }}
              >
                Sau <ChevronRight size={13} />
              </button>
            </div>
          )}

          {deleteError && <div style={errorStyle}>{deleteError.message}</div>}
        </>
      )}
    </div>
  );
}
