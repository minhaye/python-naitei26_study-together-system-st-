import { apiClient } from './apiClient';
import type { Profile, ProfileCreate, ProfileUpdate } from './profile.types';

export function createProfile(data: ProfileCreate, accessToken: string): Promise<Profile> {
  return apiClient.post<Profile>('/profiles/', data, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function fetchProfile(profileId: string): Promise<Profile> {
  return apiClient.get<Profile>(`/profiles/${profileId}`);
}

export function updateProfile(profileId: string, data: ProfileUpdate): Promise<Profile> {
  return apiClient.put<Profile>(`/profiles/${profileId}`, data);
}
