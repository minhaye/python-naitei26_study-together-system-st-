import { apiClient } from './apiClient';

export interface RoadmapPhase { id: string; name: string; position: number; progress: number; }
export interface Roadmap { id: string; title: string; goal: string; due_date: string | null; created_at: string; phases: RoadmapPhase[]; }
export interface RoadmapCreate { title: string; goal: string; due_date: string | null; phases: Array<Pick<RoadmapPhase, 'name'>>; }

export function listRoadmaps() { return apiClient.get<Roadmap[]>('/roadmaps'); }
export function createRoadmap(data: RoadmapCreate) { return apiClient.post<Roadmap>('/roadmaps', data); }
export function updateRoadmap(id: string, data: Partial<Pick<Roadmap, 'title' | 'goal' | 'due_date'>>) { return apiClient.patch<Roadmap>(`/roadmaps/${id}`, data); }
export function updateRoadmapPhase(roadmapId: string, phaseId: string, progress: number) { return apiClient.patch<RoadmapPhase>(`/roadmaps/${roadmapId}/phases/${phaseId}`, { progress }); }
