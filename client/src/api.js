
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('devpulse_token');

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem('devpulse_token');
    localStorage.removeItem('devpulse_user');
    window.dispatchEvent(new Event('devpulse:unauthorized'));
    throw new Error(body.error || 'Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }

  return body;
}
