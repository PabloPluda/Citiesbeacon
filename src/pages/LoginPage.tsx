import { useState } from 'react';
import { useUserStore } from '../store/userStore';

type Mode = 'login' | 'register';

const COUNTRIES = [
  'Argentina','Brasil','Chile','Colombia','México','Perú','Uruguay','Venezuela',
  'España','Estados Unidos','Otro',
];

export default function LoginPage() {
  const { signIn, signUp, authError, loading, clearError } = useUserStore();

  const [mode, setMode]         = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry]   = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const switchMode = (m: Mode) => { setMode(m); clearError(); setLocalError(''); };

  const handleSubmit = async () => {
    setLocalError('');
    clearError();
    if (!username.trim() || !password) { setLocalError('Completá todos los campos.'); return; }
    if (mode === 'register') {
      if (!country) { setLocalError('Elegí tu país.'); return; }
      if (password.length < 6) { setLocalError('La contraseña debe tener al menos 6 caracteres.'); return; }
      if (password !== pwConfirm) { setLocalError('Las contraseñas no coinciden.'); return; }
      await signUp(username, password, country);
    } else {
      await signIn(username, password);
    }
  };

  const error = localError || authError || '';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Outfit, sans-serif',
    }}>
      {/* Logo */}
      <img src="/Logo_CHA.png" alt="CityHero Academy"
        style={{ width: 140, marginBottom: 28 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', marginBottom: 28, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 4 }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              borderRadius: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 14,
              background: mode === m ? '#6366F1' : 'transparent',
              color: mode === m ? '#fff' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.2s',
            }}>
              {m === 'login' ? 'Ingresar' : 'Registrarse'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Usuario" value={username}
            onChange={e => setUsername(e.target.value)} placeholder="Tu nombre de jugador" />

          <Field label="Contraseña" value={password} type="password"
            onChange={e => setPassword(e.target.value)} placeholder="••••••" />

          {mode === 'register' && <>
            <Field label="Repetir contraseña" value={pwConfirm} type="password"
              onChange={e => setPwConfirm(e.target.value)} placeholder="••••••" />

            <div>
              <label style={labelStyle}>País</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{
                ...fieldStyle,
                color: country ? '#fff' : 'rgba(255,255,255,0.4)',
              }}>
                <option value="">Seleccioná tu país</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13,
            }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '14px 0',
              background: loading ? 'rgba(99,102,241,0.5)' : '#6366F1',
              color: '#fff', border: 'none', borderRadius: 12,
              fontFamily: 'Fredoka One, cursive', fontSize: 17,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: 0.3,
              transition: 'background 0.2s',
            }}
          >
            {loading ? '...' : mode === 'login' ? '¡Jugar! 🚀' : '¡Crear cuenta! 🎉'}
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        CityHero Academy
      </p>
    </div>
  );
}

// ─── Tiny sub-components ──────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder}
        autoCapitalize="none" autoCorrect="off" autoComplete="off"
        style={fieldStyle}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: 'rgba(255,255,255,0.6)',
  fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3,
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, color: '#fff',
  fontFamily: 'Outfit, sans-serif', fontSize: 15, outline: 'none',
};
