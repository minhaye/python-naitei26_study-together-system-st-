import { apiClient } from './apiClient';
import type { Profile, ProfileCreate, ProfileUpdate } from './profile.types';

interface AvatarUploadUrlResponse { path: string; upload_url: string; }

export function createProfile(data: ProfileCreate, accessToken: string): Promise<Profile> {
  return apiClient.post<Profile>('/profiles/', data, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function fetchProfile(profileId: string): Promise<Profile> {
  return apiClient.get<Profile>(`/profiles/${profileId}`);
}

export function updateProfile(profileId: string, data: ProfileUpdate): Promise<Profile> {
  return apiClient.put<Profile>(`/profiles/${profileId}`, data);
}

export async function uploadProfileAvatar(file: File): Promise<Profile> {
  const upload = await apiClient.post<AvatarUploadUrlResponse>('/profiles/me/avatar/upload-url', {
    content_type: file.type,
    file_size: file.size,
  });
  const response = await fetch(upload.upload_url, {
    method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
  });
  if (!response.ok) throw new Error(`Avatar upload failed with status ${response.status}`);
  return apiClient.post<Profile>('/profiles/me/avatar', upload);
}
