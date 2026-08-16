import { apiRequest } from './client.js';

// Folders editors are allowed to upload into. Kept in sync with the backend's
// dha/ namespace scoping (see getScopedPrefix in
// dha-cms/src/api/admin-ui/services/media.js).
export const MEDIA_FOLDERS = [
  'dha/news',
  'dha/products',
  'dha/projects',
  'dha/hero',
  'dha/services',
  'dha/settings',
];

// Images uploaded before the DHA rebrand still live under ha-can/ — their
// public_ids (and the URLs stored in the CMS) were never rewritten. Browsing
// and deleting them stays possible; uploading new ones there does not.
export const LEGACY_MEDIA_FOLDER = 'ha-can/';

// dha/hero -> ha-can/hero: the rebrand kept the sub-folder names, so the old
// copy of a folder is the same path under the ha-can/ namespace. Returns null
// for anything that isn't a dha/ folder, so callers can skip the extra fetch.
export function getLegacyFolder(folder) {
  const value = String(folder || '');
  if (!value.startsWith('dha/')) return null;
  return `${LEGACY_MEDIA_FOLDER}${value.slice('dha/'.length)}`;
}

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
