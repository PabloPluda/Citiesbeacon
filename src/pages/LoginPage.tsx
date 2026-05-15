import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

type Mode = 'login' | 'register';

// Internal password padding — user types 4 chars, Supabase needs ≥6
export function padPassword(raw: string) {
  return raw.toLowerCase() + '::cha::';
}

// ─── Full world country list ──────────────────────────────────────────────────
const ALL_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia',
  'Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica',
  'Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador',
  'Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland',
  'France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada',
  'Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
  'Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova',
  'Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo',
  'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen',
  'Zambia','Zimbabwe',
];

// ─── Country picker ───────────────────────────────────────────────────────────
function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1
    ? ALL_COUNTRIES.filter(c => c.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8)
    : ALL_COUNTRIES.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (country: string) => {
    setQuery(country);
    onChange(country);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Type your country..."
        style={{ ...fieldStyle, color: value ? '#fff' : 'rgba(255,255,255,0.5)' }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
          background: '#1e2a45', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.map(c => (
            <div
              key={c}
              onMouseDown={() => select(c)}
              style={{
                padding: '10px 14px', cursor: 'pointer', color: '#fff', fontSize: 14,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >{c}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { signIn, signUp, authError, loading, clearError, user } = useUserStore();
  const navigate = useNavigate();

  // Redirect as soon as user is set (login or register success)
  useEffect(() => {
    if (user) navigate('/map', { replace: true });
  }, [user, navigate]);

  const [mode, setMode]     = useState<Mode>('login');
  const [username, setUser] = useState('');
  const [password, setPass] = useState('');
  const [country, setCountry] = useState('');
  const [localError, setLocalError] = useState('');

  const switchMode = (m: Mode) => { setMode(m); clearError(); setLocalError(''); };

  const handleSubmit = async () => {
    setLocalError(''); clearError();
    if (!username.trim()) { setLocalError('Enter a username.'); return; }
    if (password.length !== 4) { setLocalError('Password must be exactly 4 letters.'); return; }
    if (!/^[a-zA-Z]{4}$/.test(password)) { setLocalError('Password must be 4 letters (A–Z only).'); return; }

    if (mode === 'register') {
      if (!country) { setLocalError('Please select your country.'); return; }
      await signUp(username, padPassword(password), country);
    } else {
      await signIn(username, padPassword(password));
    }
  };

  const error = localError || authError || '';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'Outfit, sans-serif',
    }}>
      <img src="/Logo_CHA.png" alt="CityHero Academy"
        style={{ width: 140, marginBottom: 28 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />

      <div style={{
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24,
        padding: '32px 28px', width: '100%', maxWidth: 380,
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
              {m === 'login' ? 'Log In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Username */}
          <div>
            <label style={labelStyle}>Username</label>
            <input value={username} onChange={e => setUser(e.target.value)}
              placeholder="Your hero name" autoCapitalize="none" autoCorrect="off" autoComplete="off"
              style={fieldStyle} />
            <p style={hintStyle}>⚠️ Never use your real name</p>
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password</label>
            <input
              value={password}
              onChange={e => {
                const v = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 4);
                setPass(v);
              }}
              placeholder="4 letters — e.g. ABCD"
              autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
              style={{ ...fieldStyle, letterSpacing: 6, fontWeight: 700, fontSize: 18, textTransform: 'uppercase' }}
            />
            <p style={hintStyle}>4 letters only — write them down, no symbols or numbers</p>
          </div>

          {/* Country (register only) */}
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Country</label>
              <CountryPicker value={country} onChange={setCountry} />
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13,
            }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            marginTop: 4, padding: '14px 0',
            background: loading ? 'rgba(99,102,241,0.5)' : '#6366F1',
            color: '#fff', border: 'none', borderRadius: 12,
            fontFamily: 'Fredoka One, cursive', fontSize: 17,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.3,
          }}>
            {loading ? '...' : mode === 'login' ? 'Play! 🚀' : 'Create Account! 🎉'}
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        CityHero Academy
      </p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: 'rgba(255,255,255,0.65)',
  fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3,
};

const hintStyle: React.CSSProperties = {
  margin: '5px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.38)',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: 15, outline: 'none',
};
