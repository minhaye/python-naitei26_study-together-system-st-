import { apiClient } from './apiClient';
import { supabase } from './supabase';
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

export async function uploadProfileAvatar(file: File): Promise<Profile> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Ảnh phải là JPEG, PNG, WebP hoặc GIF và không quá 5 MB.');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Bạn cần đăng nhập để thay ảnh đại diện.');
  const path = `users/${user.id}/${crypto.randomUUID()}.avatar`;
  const { error } = await supabase.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return apiClient.post<Profile>('/profiles/me/avatar', { path });
}
