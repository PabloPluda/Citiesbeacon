import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore, DEFAULT_MISSION_CONFIG } from '../store/adminStore';
import type { AdminBuildCat } from '../store/adminStore';
import type { BuildItem } from '../game/cityBuilderData';
import { supabase } from '../lib/supabase';

type Tab = 'missions' | 'builder' | 'analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneCats(cats: AdminBuildCat[]): AdminBuildCat[] {
  return cats.map(c => ({ ...c, items: c.items.map(i => ({ ...i })) }));
}

const BLANK_ITEM: Omit<BuildItem, 'key'> = { label: '', cost: 10, w: 1, d: 1, file: '' };

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onChange,
  onDelete,
}: {
  item: BuildItem;
  onChange: (patch: Partial<BuildItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 130,
      maxWidth: 160,
      flex: '0 0 auto',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <img
          src={`/Builder/${item.file}.png`}
          alt={item.label}
          style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: '#F8FAFC' }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
        <button
          onClick={onDelete}
          title="Delete item"
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 20, height: 20, borderRadius: '50%',
            background: '#EF4444', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      <input
        value={item.label}
        onChange={e => onChange({ label: e.target.value })}
        placeholder="Label"
        style={inputStyle}
      />

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={labelStyle}>💰</span>
        <input
          type="number" min={0} max={999}
          value={item.cost}
          onChange={e => onChange({ cost: Number(e.target.value) })}
          style={{ ...inputStyle, width: 54 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={labelStyle}>W</span>
        <select value={item.w} onChange={e => onChange({ w: Number(e.target.value) })} style={selectStyle}>
          <option value={1}>1</option><option value={2}>2</option>
          <option value={3}>3</option><option value={4}>4</option>
        </select>
        <span style={labelStyle}>D</span>
        <select value={item.d} onChange={e => onChange({ d: Number(e.target.value) })} style={selectStyle}>
          <option value={1}>1</option><option value={2}>2</option>
          <option value={3}>3</option><option value={4}>4</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ ...labelStyle, whiteSpace: 'nowrap' }}>File</span>
        <input
          value={item.file}
          onChange={e => onChange({ file: e.target.value })}
          placeholder="Filename (no .png)"
          style={{ ...inputStyle, fontSize: '0.6rem' }}
        />
      </div>
    </div>
  );
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemCard({ onAdd }: { onAdd: (item: BuildItem) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<BuildItem, 'key'>>({ ...BLANK_ITEM });

  const submit = () => {
    if (!draft.label.trim() || !draft.file.trim()) return;
    const key = `custom_${draft.file.replace(/\s+/g, '_')}_${Date.now()}`;
    onAdd({ key, ...draft });
    setDraft({ ...BLANK_ITEM });
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          minWidth: 100, height: 180,
          background: '#F1F5F9',
          border: '2px dashed #CBD5E1',
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6, color: '#94A3B8', fontSize: 13,
          flex: '0 0 auto',
        }}
      >
        <span style={{ fontSize: 28 }}>＋</span>
        New item
      </button>
    );
  }

  return (
    <div style={{
      background: '#F8FAFC',
      border: '2px solid #6366F1',
      borderRadius: 12,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 160,
      flex: '0 0 auto',
    }}>
      <strong style={{ fontSize: 12, color: '#6366F1' }}>New item</strong>

      <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
        placeholder="Label *" style={inputStyle} />

      <div style={{ display: 'flex', gap: 4 }}>
        <span style={labelStyle}>💰</span>
        <input type="number" min={0} value={draft.cost}
          onChange={e => setDraft(d => ({ ...d, cost: Number(e.target.value) }))}
          style={{ ...inputStyle, width: 54 }} />
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={labelStyle}>W</span>
        <select value={draft.w} onChange={e => setDraft(d => ({ ...d, w: Number(e.target.value) }))} style={selectStyle}>
          <option value={1}>1</option><option value={2}>2</option>
        </select>
        <span style={labelStyle}>D</span>
        <select value={draft.d} onChange={e => setDraft(d => ({ ...d, d: Number(e.target.value) }))} style={selectStyle}>
          <option value={1}>1</option><option value={2}>2</option>
        </select>
      </div>

      <input value={draft.file} onChange={e => setDraft(d => ({ ...d, file: e.target.value }))}
        placeholder="Filename in /Builder/ (no .png) *" style={{ ...inputStyle, fontSize: '0.6rem' }} />

      {draft.file && (
        <img src={`/Builder/${draft.file}.png`} alt="preview"
          style={{ width: 48, height: 48, objectFit: 'contain', alignSelf: 'center', background: '#E2E8F0', borderRadius: 6 }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button onClick={submit} disabled={!draft.label.trim() || !draft.file.trim()}
          style={{ ...btnStyle, background: '#6366F1', color: '#fff', flex: 1 }}>Add</button>
        <button onClick={() => setOpen(false)}
          style={{ ...btnStyle, background: '#E2E8F0', color: '#475569', flex: 1 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

interface CountryRow { pais_residencia: string | null; count: number }
interface Stats {
  total: number;
  newInPeriod: number;
  activeInPeriod: number;
  countries: CountryRow[];
}

function today() { return new Date().toISOString().slice(0, 10); }
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function AnalyticsTab() {
  const [from, setFrom]   = useState(monthAgo());
  const [to, setTo]       = useState(today());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true); setError('');
    try {
      const fromTs = `${from}T00:00:00.000Z`;
      const toTs   = `${to}T23:59:59.999Z`;

      // Total users
      const { count: total, error: e1 } = await supabase
        .from('perfiles_usuarios').select('*', { count: 'exact', head: true });
      if (e1) throw e1;

      // New users in period (by created_at)
      const { count: newIn, error: e2 } = await supabase
        .from('perfiles_usuarios').select('*', { count: 'exact', head: true })
        .gte('created_at', fromTs).lte('created_at', toTs);
      if (e2) throw e2;

      // Active users in period (by last_active)
      const { count: activeIn, error: e3 } = await supabase
        .from('perfiles_usuarios').select('*', { count: 'exact', head: true })
        .gte('last_active', fromTs).lte('last_active', toTs);
      if (e3) throw e3;

      // Countries breakdown (new users in period)
      const { data: countryRows, error: e4 } = await supabase
        .from('perfiles_usuarios')
        .select('pais_residencia')
        .gte('created_at', fromTs).lte('created_at', toTs);
      if (e4) throw e4;

      const countryMap: Record<string, number> = {};
      (countryRows ?? []).forEach(r => {
        const c = r.pais_residencia || 'Unknown';
        countryMap[c] = (countryMap[c] || 0) + 1;
      });
      const countries: CountryRow[] = Object.entries(countryMap)
        .map(([pais_residencia, count]) => ({ pais_residencia, count }))
        .sort((a, b) => b.count - a.count);

      setStats({ total: total ?? 0, newInPeriod: newIn ?? 0, activeInPeriod: activeIn ?? 0, countries });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      setError(`Error fetching data: ${msg}`);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxCountry = stats ? Math.max(...stats.countries.map(c => c.count), 1) : 1;

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#1E293B' }}>Usage Analytics</h2>

      {/* Date filter */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '16px 20px', marginBottom: 24,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>FROM</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>TO</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ ...inputStyle, width: 150 }} />
        </div>
        <button onClick={fetchStats} disabled={loading}
          style={{ ...btnStyle, background: '#6366F1', color: '#fff', height: 34 }}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
          padding: '10px 14px', color: '#EF4444', fontSize: 13, marginBottom: 20,
        }}>{error}</div>
      )}

      {stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Users" value={stats.total} icon="👥" color="#6366F1" note="all time" />
            <StatCard label="New Users" value={stats.newInPeriod} icon="🆕" color="#10B981"
              note={`${from} → ${to}`} />
            <StatCard label="Active Users" value={stats.activeInPeriod} icon="🎮" color="#F59E0B"
              note={`last_active in period`} />
          </div>

          {/* Countries */}
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#1E293B' }}>
              🌍 Countries — new users in selected period
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400, marginLeft: 8 }}>
                ({stats.countries.length} countries, {stats.newInPeriod} users)
              </span>
            </h3>
            {stats.countries.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13 }}>No data for this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.countries.map(({ pais_residencia, count }) => {
                  const pct = Math.round((count / maxCountry) * 100);
                  return (
                    <div key={pais_residencia ?? 'unknown'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{pais_residencia || 'Unknown'}</span>
                        <span style={{ color: '#64748B' }}>{count} user{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 99,
                          background: 'linear-gradient(90deg,#6366F1,#8B5CF6)',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, note }: {
  label: string; value: number; icon: string; color: string; note: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{note}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const navigate = useNavigate();
  const store = useAdminStore();

  const [tab, setTab] = useState<Tab>('missions');

  // ── Missions local state ────────────────────────────────────────────────────
  const [missionDraft, setMissionDraft] = useState(() =>
    DEFAULT_MISSION_CONFIG.map(m => {
      const eff = store.getEffectiveMission(m.id);
      return { id: m.id, title: eff.title, icon: eff.icon };
    })
  );
  const [missionSaved, setMissionSaved] = useState(false);

  const saveMissions = () => {
    missionDraft.forEach(m => {
      const def = DEFAULT_MISSION_CONFIG.find(d => d.id === m.id)!;
      store.setMissionOverride(m.id, {
        title: m.title !== def.title ? m.title : undefined,
        icon:  m.icon  !== def.icon  ? m.icon  : undefined,
      });
    });
    setMissionSaved(true);
    setTimeout(() => setMissionSaved(false), 2000);
  };

  // ── Builder local state ─────────────────────────────────────────────────────
  const [cats, setCats] = useState<AdminBuildCat[]>(() => cloneCats(store.getEffectiveCats()));
  const [activeCat, setActiveCat] = useState(0);
  const [builderSaved, setBuilderSaved] = useState(false);

  const saveBuilder = () => {
    store.setBuilderCats(cats);
    setBuilderSaved(true);
    setTimeout(() => setBuilderSaved(false), 2000);
  };

  const patchItem = useCallback((catIdx: number, itemIdx: number, patch: Partial<BuildItem>) => {
    setCats(prev => {
      const next = cloneCats(prev);
      next[catIdx].items[itemIdx] = { ...next[catIdx].items[itemIdx], ...patch };
      return next;
    });
  }, []);

  const deleteItem = useCallback((catIdx: number, itemIdx: number) => {
    setCats(prev => {
      const next = cloneCats(prev);
      next[catIdx].items.splice(itemIdx, 1);
      return next;
    });
  }, []);

  const addItem = useCallback((catIdx: number, item: BuildItem) => {
    setCats(prev => {
      const next = cloneCats(prev);
      next[catIdx].items.push(item);
      return next;
    });
  }, []);

  const resetAll = () => {
    if (!confirm('Reset all admin settings to defaults? This cannot be undone.')) return;
    store.resetAll();
    window.location.reload();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: 'Outfit, sans-serif' }}>

      {/* Top bar */}
      <div style={{
        background: '#1E293B', color: '#fff',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/map')} style={{
          background: 'none', border: '1px solid #475569', color: '#CBD5E1',
          borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 13,
        }}>← Map</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Admin Panel</span>
      </div>

      {/* Tab nav */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        padding: '0 20px',
      }}>
        {([
          ['missions', '🗺️ Missions'],
          ['builder',  '🏗️ City Builder'],
          ['analytics','📊 Analytics'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#6366F1' : '#64748B',
            borderBottom: tab === t ? '2px solid #6366F1' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── MISSIONS TAB ─────────────────────────────────────────────────── */}
        {tab === 'missions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#1E293B' }}>Mission Names</h2>
              <button onClick={saveMissions} style={{ ...btnStyle, background: '#6366F1', color: '#fff' }}>
                {missionSaved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {missionDraft.map((m, i) => (
                <div key={m.id} style={{
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ color: '#94A3B8', fontSize: 13, minWidth: 20 }}>#{m.id}</span>
                  <input
                    value={m.icon}
                    onChange={e => setMissionDraft(d => d.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                    style={{ ...inputStyle, width: 44, textAlign: 'center', fontSize: 18 }}
                  />
                  <input
                    value={m.title}
                    onChange={e => setMissionDraft(d => d.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      const def = DEFAULT_MISSION_CONFIG.find(d => d.id === m.id)!;
                      setMissionDraft(d => d.map((x, j) => j === i ? { ...x, title: def.title, icon: def.icon } : x));
                    }}
                    title="Reset to default"
                    style={{ ...btnStyle, background: '#F1F5F9', color: '#64748B', fontSize: 11 }}
                  >Reset</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BUILDER TAB ──────────────────────────────────────────────────── */}
        {tab === 'builder' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#1E293B' }}>City Builder Items</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveBuilder} style={{ ...btnStyle, background: '#6366F1', color: '#fff' }}>
                  {builderSaved ? '✓ Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8' }}>
              W = columns to the right, D = columns to the left (isometric footprint). Images must exist in <code>/Builder/</code> on the server.
            </p>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {cats.map((cat, i) => (
                <button key={i} onClick={() => setActiveCat(i)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: activeCat === i ? '2px solid #6366F1' : '2px solid #E2E8F0',
                  background: activeCat === i ? '#EEF2FF' : '#fff',
                  color: activeCat === i ? '#6366F1' : '#64748B',
                  cursor: 'pointer', fontSize: 13, fontWeight: activeCat === i ? 700 : 400,
                }}>
                  {cat.emoji} {cat.label} <span style={{ color: '#94A3B8', fontSize: 11 }}>({cat.items.length})</span>
                </button>
              ))}
            </div>

            {/* Items row */}
            <div style={{
              display: 'flex', gap: 12, overflowX: 'auto',
              paddingBottom: 12, alignItems: 'flex-start',
            }}>
              {cats[activeCat].items.map((item, j) => (
                <ItemCard
                  key={item.key}
                  item={item}
                  onChange={patch => patchItem(activeCat, j, patch)}
                  onDelete={() => deleteItem(activeCat, j)}
                />
              ))}
              <AddItemCard onAdd={item => addItem(activeCat, item)} />
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>
              Changes are local until you click <strong>Save Changes</strong>. The game reads the saved config on next load.
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ────────────────────────────────────────────────── */}
        {tab === 'analytics' && <AnalyticsTab />}

        {/* ── DANGER ZONE ──────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 40, borderTop: '1px solid #E2E8F0', paddingTop: 20,
        }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: '#94A3B8' }}>Danger zone</h3>
          <button onClick={resetAll} style={{ ...btnStyle, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5' }}>
            Reset ALL admin settings to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: '0.75rem',
  fontFamily: 'Outfit, sans-serif',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  padding: '3px 4px',
  fontSize: '0.75rem',
  background: '#fff',
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  minWidth: 16,
};

const btnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '7px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'Outfit, sans-serif',
  fontWeight: 600,
};
