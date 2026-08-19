import type { UserSummary } from './profile.types';

/** Mirrors NoteCreate/NoteUpdate's Field(max_length=...) (app/notes/dto/note_dto.py) --
 * backend validation remains authoritative, these only drive frontend maxLength/counter UX. */
export const NOTE_TITLE_MAX_LENGTH = 100;
export const NOTE_CONTENT_MAX_LENGTH = 2000;

/** Mirrors NoteResponse (app/notes/dto/note_dto.py). `author` is the canonical identity
 * source for the author -- see resource.types.ts's Resource.uploader, never derive a label
 * from `author_id` alone. */
export interface Note {
  id: string;
  group_id: string;
  author_id: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author: UserSummary;
}

/** Mirrors NoteCreate -- no author_id: the backend always derives the author from the
 * authenticated caller (see note_router.create_note). */
export interface NoteCreate {
  group_id: string;
  title?: string | null;
  content: string;
}

/** Mirrors NoteUpdate. */
export interface NoteUpdate {
  title?: string | null;
  content?: string;
}
