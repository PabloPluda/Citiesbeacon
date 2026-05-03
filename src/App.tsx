import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import MissionMap from './pages/MissionMap';
import GameWindow from './pages/GameWindow';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<Landing />} />

        {/* Game onboarding (new users) / entry point */}
        <Route path="/play" element={<Onboarding />} />

        {/* App shell — with bottom nav */}
        <Route element={<Layout />}>
          <Route path="/map" element={<MissionMap />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:missionId" element={<GameWindow />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
