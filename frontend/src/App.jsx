
import { useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import Layout from './components/Layout.jsx';
import Home, { Welcome } from './pages/Home.jsx';
import Detect from './pages/Detect.jsx';
import History from './pages/History.jsx';
import Guidance from './pages/Guidance.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';

import {
  Login,
  Signup,
  Forgot,
  ResetPassword,
} from './pages/Auth.jsx';

function getUser() {
  try {
    return JSON.parse(
      localStorage.getItem('lsdCurrentUser') || 'null'
    );
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(getUser);
  const navigate = useNavigate();

  // Login
  function login(userData) {
    localStorage.setItem(
      'lsdCurrentUser',
      JSON.stringify(userData)
    );

    setUser(userData);
    navigate('/app/home', { replace: true });
  }

  // Logout
  function logout() {
    localStorage.removeItem('lsdCurrentUser');
    setUser(null);
    navigate('/login', { replace: true });
  }

  // Update user profile
  function updateUser(updatedUser) {
    localStorage.setItem(
      'lsdCurrentUser',
      JSON.stringify(updatedUser)
    );

    setUser(updatedUser);
  }

  return (
    <Routes>
      {/* Public landing page */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/app/home" replace />
          ) : (
            <Welcome />
          )
        }
      />

      {/* Authentication pages */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/app/home" replace />
          ) : (
            <Login login={login} />
          )
        }
      />

      <Route
        path="/signup"
        element={
          user ? (
            <Navigate to="/app/home" replace />
          ) : (
            <Signup login={login} />
          )
        }
      />

      <Route
        path="/forgot"
        element={<Forgot />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      {/* Main application workspace */}
      <Route
        path="/app"
        element={
          user ? (
            <Layout user={user} logout={logout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        {/* Default application page */}
        <Route
          index
          element={<Navigate to="home" replace />}
        />

        {/* Home */}
        <Route
          path="home"
          element={<Home user={user} />}
        />

        {/* Disease detection */}
        <Route
          path="detect"
          element={<Detect />}
        />

        {/* Screening history */}
        <Route
          path="history"
          element={<History />}
        />

        {/* Guidance */}
        <Route
          path="guidance"
          element={<Guidance />}
        />

        {/* User profile */}
        <Route
          path="profile"
          element={
            <Profile
              user={user}
              update={updateUser}
              logout={logout}
            />
          }
        />

        {/* Admin dashboard */}
        <Route
          path="admin"
          element={<Admin />}
        />
      </Route>

      {/* Handle unknown URLs */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
