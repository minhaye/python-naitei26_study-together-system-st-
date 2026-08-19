import { apiClient } from './apiClient';
import type { Note, NoteCreate, NoteUpdate } from './note.types';

export function listGroupNotes(groupId: string): Promise<Note[]> {
  const params = new URLSearchParams({ group_id: groupId });
  return apiClient.get<Note[]>(`/notes?${params.toString()}`);
}

export function createNote(data: NoteCreate): Promise<Note> {
  return apiClient.post<Note>('/notes', data);
}

export function updateNote(noteId: string, data: NoteUpdate): Promise<Note> {
  return apiClient.put<Note>(`/notes/${noteId}`, data);
}

export function deleteNote(noteId: string): Promise<void> {
  return apiClient.delete<void>(`/notes/${noteId}`);
}
