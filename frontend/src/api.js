const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('lsdAccessToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.detail || `API error ${response.status}`);
  return data;
}

export async function predict(file) {
  const form = new FormData();
  form.append('file', file);
  // Prediction request and response are unchanged.
  const response = await fetch(`${BASE}/predict`, { method: 'POST', body: form });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.detail || `API error ${response.status}`);
  return data;
}

export async function ping() {
  const response = await fetch(`${BASE}/`);
  if (!response.ok) throw new Error('Backend unavailable');
  return response.json();
}

export async function signupUser(payload) {
  const data = await request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  localStorage.setItem('lsdAccessToken', data.access_token);
  return data.user;
}

export async function loginUser(identifier, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  localStorage.setItem('lsdAccessToken', data.access_token);
  return data.user;
}

export async function updateUserProfile(payload) {
  const data = await request('/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.user;
}

export function clearAuthToken() {
  localStorage.removeItem('lsdAccessToken');
}


export async function requestPasswordReset(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
