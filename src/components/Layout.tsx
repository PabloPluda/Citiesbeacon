import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, User } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isGameRoute = location.pathname.startsWith('/game');

  if (isGameRoute) {
    return <Outlet />; // No nav bar inside the game
  }

  const navItems = [
    { path: '/', icon: <Home size={24} />, label: 'Home' },
    { path: '/map', icon: <MapIcon size={24} />, label: 'City Map' },
    { path: '/profile', icon: <User size={24} />, label: 'Profile' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>

      {/* Bottom Navigation Bar */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: 'white',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        zIndex: 100
      }}>
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--primary)' : '#A0AEC0',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                padding: '8px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#E6F3FF' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 'bold' : 'normal', fontFamily: 'var(--font-ui)' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
