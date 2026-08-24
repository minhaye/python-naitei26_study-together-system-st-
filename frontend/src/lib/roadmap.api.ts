import { apiClient } from './apiClient';

export interface RoadmapPhase { id: string; name: string; position: number; progress: number; }
export interface Roadmap { id: string; title: string; goal: string; due_date: string | null; created_at: string; phases: RoadmapPhase[]; }
export interface RoadmapCreate { title: string; goal: string; due_date: string | null; phases: Array<Pick<RoadmapPhase, 'name'>>; }
export interface RoadmapSuggestion { title: string; goal: string; phases: Array<{ name: string }>; }
export interface RoadmapQuestion { question: string; options: Array<{ label: string }>; }
export interface RoadmapAnswer { question: string; answer: string; }

export interface SuggestedTask { title: string; due_date: string; priority: 1 | 2 | 3; }
export interface TaskSuggestionResponse { tasks: SuggestedTask[]; }

export function listRoadmaps() { return apiClient.get<Roadmap[]>('/roadmaps'); }
export function suggestRoadmapQuestions(description: string) {
  return apiClient.post<{ questions: RoadmapQuestion[] }>('/roadmaps/suggest/questions', { description });
}
export function suggestRoadmap(description: string, answers: RoadmapAnswer[] = []) {
  return apiClient.post<RoadmapSuggestion>('/roadmaps/suggest', { description, answers });
}
export function suggestTasks(goal: string, phases: string[], today: string, due_date: string | null) {
  return apiClient.post<TaskSuggestionResponse>('/roadmaps/suggest/tasks', { goal, phases, today, due_date });
}
export function createRoadmap(data: RoadmapCreate) { return apiClient.post<Roadmap>('/roadmaps', data); }
export function updateRoadmap(id: string, data: Partial<Pick<Roadmap, 'title' | 'goal' | 'due_date'>>) { return apiClient.patch<Roadmap>(`/roadmaps/${id}`, data); }
export function deleteRoadmap(id: string) { return apiClient.delete<void>(`/roadmaps/${id}`); }
export function addRoadmapPhase(roadmapId: string, name: string) { return apiClient.post<RoadmapPhase>(`/roadmaps/${roadmapId}/phases`, { name }); }
export function updateRoadmapPhase(roadmapId: string, phaseId: string, data: { progress?: number; name?: string }) { return apiClient.patch<RoadmapPhase>(`/roadmaps/${roadmapId}/phases/${phaseId}`, data); }
export function deleteRoadmapPhase(roadmapId: string, phaseId: string) { return apiClient.delete<void>(`/roadmaps/${roadmapId}/phases/${phaseId}`); }
