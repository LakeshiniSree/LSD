
import { NavLink, Outlet } from 'react-router-dom';
import {
  House,
  Camera,
  History,
  BookOpen,
  UserRound,
  LogOut,
  Stethoscope,
  ShieldCheck
} from 'lucide-react';

export default function Layout({ user, logout }) {
  
const adminEmails = [
  "lakeshinisreekuntamukkala@gmail.com",
  "narenderdammalapati12@gmail.com"
];

const links = [
  ['/app/home', 'Home', House],
  ['/app/detect', 'Detect', Camera],
  ['/app/history', 'History', History],
  ['/app/guidance', 'Guidance', BookOpen],
  ['/app/profile', 'Profile', UserRound],

  ...(adminEmails.includes(
    String(user?.email || '').trim().toLowerCase()
  )
    ? [['/app/admin', 'Admin Dashboard', ShieldCheck]]
    : [])
];


  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><Stethoscope /></span>
          <span>
            LSD <b>Care</b>
            <small>CATTLE HEALTH SCREENING</small>
          </span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        {links.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'navlink ' + (isActive ? 'active' : '')
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}

        <div className="side-user">
          <span className="avatar">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </span>

          <span>
            <b>{user?.name}</b>
            <small>{user?.role}</small>
          </span>

          <button title="Log out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>Workspace / <b>LSD Care</b></span>

          <span className="live">
            <i /> Screening workspace
          </span>

          <button
            className="mobile-logout"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </header>

        <div className="content">
          <Outlet />
        </div>

        <footer>
          AI-assisted preliminary screening · Always consult a veterinarian for suspected disease.
        </footer>
      </main>
    </div>
  );
}
