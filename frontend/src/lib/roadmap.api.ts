import { apiClient } from './apiClient';

export interface RoadmapPhase { id: string; name: string; position: number; progress: number; }
export interface Roadmap { id: string; title: string; goal: string; due_date: string | null; created_at: string; phases: RoadmapPhase[]; }
export interface RoadmapCreate { title: string; goal: string; due_date: string | null; phases: Array<Pick<RoadmapPhase, 'name'>>; }

export function listRoadmaps() { return apiClient.get<Roadmap[]>('/roadmaps'); }
export function createRoadmap(data: RoadmapCreate) { return apiClient.post<Roadmap>('/roadmaps', data); }
export function updateRoadmap(id: string, data: Partial<Pick<Roadmap, 'title' | 'goal' | 'due_date'>>) { return apiClient.patch<Roadmap>(`/roadmaps/${id}`, data); }
export function deleteRoadmap(id: string) { return apiClient.delete<void>(`/roadmaps/${id}`); }
export function addRoadmapPhase(roadmapId: string, name: string) { return apiClient.post<RoadmapPhase>(`/roadmaps/${roadmapId}/phases`, { name }); }
export function updateRoadmapPhase(roadmapId: string, phaseId: string, data: { progress?: number; name?: string }) { return apiClient.patch<RoadmapPhase>(`/roadmaps/${roadmapId}/phases/${phaseId}`, data); }
export function deleteRoadmapPhase(roadmapId: string, phaseId: string) { return apiClient.delete<void>(`/roadmaps/${roadmapId}/phases/${phaseId}`); }
