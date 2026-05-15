import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Map as MapIcon, User, Menu } from 'lucide-react';
import { useUserStore } from '../store/userStore';

export default function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { signOut } = useUserStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isGameRoute = location.pathname.startsWith('/game');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isGameRoute) {
    return <Outlet />;
  }

  const isMap     = location.pathname === '/map';
  const isProfile = location.pathname === '/profile';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>

      {/* ── Top nav bar ──────────────────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
      }}>

        {/* Left: logo */}
        <img
          src="/Logo_CHA_header.png?v=2"
          alt="CityHero Academy"
          style={{ height: 40, display: 'block', cursor: 'pointer' }}
          onClick={() => navigate('/map')}
        />

        {/* Right: icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

          {/* Map icon */}
          <NavBtn
            active={isMap}
            onClick={() => navigate('/map')}
            title="Map"
          >
            <MapIcon size={22} />
          </NavBtn>

          {/* Profile icon */}
          <NavBtn
            active={isProfile}
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            <User size={22} />
          </NavBtn>

          {/* Settings / hamburger */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <NavBtn
              active={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
              title="Settings"
            >
              <Menu size={22} />
            </NavBtn>

            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#1E293B',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                minWidth: 160,
                zIndex: 300,
              }}>
                <DropItem
                  label="Preferencias"
                  onClick={() => { setMenuOpen(false); /* TODO */ }}
                />
                <DropItem
                  label="Salir"
                  danger
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    navigate('/login', { replace: true });
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </nav>

      {/* ── Page content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>

    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function NavBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
        border: 'none',
        borderRadius: 10,
        padding: '8px',
        cursor: 'pointer',
        color: active ? '#818CF8' : 'rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function DropItem({
  label, onClick, danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '13px 18px',
        background: hover ? 'rgba(255,255,255,0.07)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'left',
        color: danger ? '#F87171' : 'rgba(255,255,255,0.85)',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '0.92rem',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {label}
    </button>
  );
}
