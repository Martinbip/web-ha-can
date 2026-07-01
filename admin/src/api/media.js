import { apiRequest } from './client.js';

// Folders editors are allowed to upload/browse into. Kept in sync with the
// backend's ha-can/ namespace scoping (see getScopedPrefix in
// dha-cms/src/api/admin-ui/services/media.js).
export const MEDIA_FOLDERS = [
  'ha-can/news',
  'ha-can/products',
  'ha-can/projects',
  'ha-can/hero',
  'ha-can/services',
  'ha-can/settings',
];

export function listMedia(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/media${query ? `?${query}` : ''}`);
}

export function uploadMedia(file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  return apiRequest('/media/upload', { method: 'POST', body: formData });
}

export function deleteMedia(publicId) {
  return apiRequest(`/media/${encodeURIComponent(publicId)}`, { method: 'DELETE' });
}
