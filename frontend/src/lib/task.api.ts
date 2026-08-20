import { apiClient } from './apiClient';
export type TaskPriority = 1 | 2 | 3;
export interface StudyTask { id: string; title: string; due_date: string; priority: TaskPriority; completed_at: string | null; created_at: string; }
export function listTasks(from: string, to: string) { return apiClient.get<StudyTask[]>(`/tasks?from_date=${from}&to_date=${to}`); }
export function createTask(data: Pick<StudyTask, 'title' | 'due_date' | 'priority'>) { return apiClient.post<StudyTask>('/tasks', data); }
export function createTasks(data: Array<Pick<StudyTask, 'title' | 'due_date' | 'priority'>>) { return apiClient.post<StudyTask[]>('/tasks/bulk', { tasks: data }); }
export function updateTask(id: string, data: Partial<Pick<StudyTask, 'title' | 'due_date' | 'priority'>>) { return apiClient.patch<StudyTask>(`/tasks/${id}`, data); }
export function toggleTaskComplete(id: string) { return apiClient.patch<StudyTask>(`/tasks/${id}/complete`); }
export function deleteTask(id: string) { return apiClient.delete<void>(`/tasks/${id}`); }
