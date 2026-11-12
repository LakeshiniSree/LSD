const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export async function getAdminOverview() {
  const token = localStorage.getItem('lsdAccessToken');
  if (!token) throw new Error('Please sign in again.');

  const response = await fetch(`${API_BASE}/admin/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let body = {};
  try { body = await response.json(); } catch { /* response may not be JSON */ }
  if (!response.ok) throw new Error(body.detail || `Admin request failed (${response.status}).`);
  return body;
}
