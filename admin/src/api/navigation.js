import { apiRequest } from './client.js';

export function getNavigation() {
  return apiRequest('/navigation').then((payload) => payload.data?.items || []);
}

export function saveNavigation(items) {
  return apiRequest('/navigation', {
    method: 'PUT',
    body: JSON.stringify({ data: { items } }),
  }).then((payload) => payload.data?.items || []);
}
