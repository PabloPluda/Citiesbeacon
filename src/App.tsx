import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import MissionMap from './pages/MissionMap';
import GameWindow from './pages/GameWindow';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MissionMap />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:missionId" element={<GameWindow />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
