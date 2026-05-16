import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import MissionMap from './pages/MissionMap';
import GameWindow from './pages/GameWindow';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import AdminPanel from './pages/AdminPanel';
import LoginPage from './pages/LoginPage';
import { useUserStore } from './store/userStore';
import './index.css';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUserStore();
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#1a1a2e', color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: 18,
    }}>
      Cargando...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const initialize = useUserStore(s => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public landing page */}
        <Route path="/" element={<Landing />} />

        {/* /play redirects to login (kept for old bookmarks) */}
        <Route path="/play" element={<Navigate to="/login" replace />} />

        {/* Protected app shell — with bottom nav */}
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/map" element={<MissionMap />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:missionId" element={<GameWindow />} />
        </Route>

        {/* Admin — no auth guard for now */}
        <Route path="/admin" element={<AdminPanel />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
