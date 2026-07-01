import { apiRequest } from './client.js';

export function listResources(type, params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/resources/${type}${query ? `?${query}` : ''}`);
}

export function getResource(type, id) {
  return apiRequest(`/resources/${type}/${id}`);
}

export function createResource(type, data) {
  return apiRequest(`/resources/${type}`, { method: 'POST', body: JSON.stringify({ data }) });
}

export function saveResource(type, id, data) {
  return apiRequest(`/resources/${type}/${id}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

export function deleteResource(type, id) {
  return apiRequest(`/resources/${type}/${id}`, { method: 'DELETE' });
}

export function publishResource(type, id) {
  return apiRequest(`/resources/${type}/${id}/publish`, { method: 'POST' });
}

export function unpublishResource(type, id) {
  return apiRequest(`/resources/${type}/${id}/unpublish`, { method: 'POST' });
}
