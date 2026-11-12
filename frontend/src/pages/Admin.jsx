import { useEffect, useState } from 'react';
import './Admin.css';
import { RefreshCw, ShieldCheck, Users, Activity, AlertCircle } from 'lucide-react';
import { getAdminOverview } from '../adminApi.js';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await getAdminOverview());
    } catch (err) {
      setError(err.message || 'Unable to load administrator data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={15} /> PRIVATE ADMIN AREA</div>
          <h1>Admin Dashboard</h1>
          <p>Manage registered LSD Care accounts and review screening activity.</p>
        </div>
        <button className="admin-refresh" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'admin-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="admin-error" role="alert"><AlertCircle size={18} /> {error}</div>
      )}

      <div className="admin-stats">
        <article className="admin-stat-card">
          <span className="admin-stat-icon users"><Users size={20} /></span>
          <div><strong>{loading ? '—' : data?.total_users ?? 0}</strong><span>Registered users</span></div>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-icon activity"><Activity size={20} /></span>
          <div><strong>{loading ? '—' : data?.total_screenings ?? 0}</strong><span>Total screenings</span></div>
        </article>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div><h2>Registered users</h2><p>Only non-sensitive account details are shown.</p></div>
          <span className="admin-private-label"><ShieldCheck size={14} /> Private</span>
        </div>
        {loading ? <div className="admin-empty">Loading registered users…</div> :
          data?.users?.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Screenings</th></tr></thead>
                <tbody>{data.users.map(user => (
                  <tr key={user.id}>
                    <td className="admin-user-name">{user.name}</td>
                    <td>{user.email}</td><td>{user.phone}</td><td><span className="admin-role">{user.role}</span></td>
                    <td>{formatDate(user.created_at)}</td><td>{user.screening_count}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="admin-empty">No registered users found.</div>
        }
      </div>
      <p className="admin-security-note"><ShieldCheck size={15} /> This page is protected by a server-side administrator check. Passwords are never displayed.</p>
    </section>
  );
}
