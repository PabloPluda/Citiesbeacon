import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAdminStore, DEFAULT_MISSION_CONFIG } from '../store/adminStore';
import type { AdminBuildCat } from '../store/adminStore';
import type { BuildItem } from '../game/cityBuilderData';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://ielaccsufrrafhcssqpu.supabase.co';

type Tab = 'missions' | 'builder' | 'analytics' | 'users' | 'seo';
type AdminClient = ReturnType<typeof createClient>;

const GAME_LABEL: Record<string, string> = {
  '1': 'Trash', '2': 'Cross', '3': 'Lights', '4': 'Water', '5': 'Dog',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneCats(cats: AdminBuildCat[]): AdminBuildCat[] {
  return cats.map(c => ({ ...c, items: c.items.map(i => ({ ...i })) }));
}

const BLANK_ITEM: Omit<BuildItem, 'key'> = { label: '', cost: 10, w: 1, d: 1, file: '' };

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, onChange, onDelete,
}: {
  item: BuildItem;
  onChange: (patch: Partial<BuildItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 130, maxWidth: 160, flex: '0 0 auto',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <img
          src={`/Builder/${item.file}.png`} alt={item.label}
          style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: '#F8FAFC' }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
        <button onClick={onDelete} title="Delete item" style={{
          position: 'absolute', top: -6, right: -6,
          width: 20, height: 20, borderRadius: '50%',
          background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>
      <input value={item.label} onChange={e => onChange({ label: e.target.value })}
        placeholder="Label" style={inputStyle} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={labelStyle}>💰</span>
        <input type="number" min={0} max={999} value={item.cost}
          onChange={e => onChange({ cost: Number(e.target.value) })}
          style={{ ...inputStyle, width: 54 }} />
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
        <input value={item.file} onChange={e => onChange({ file: e.target.value })}
          placeholder="Filename (no .png)"
          style={{ ...inputStyle, fontSize: '0.6rem' }} />
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
      <button onClick={() => setOpen(true)} style={{
        minWidth: 100, height: 180, background: '#F1F5F9',
        border: '2px dashed #CBD5E1', borderRadius: 12, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 6, color: '#94A3B8', fontSize: 13,
        flex: '0 0 auto',
      }}>
        <span style={{ fontSize: 28 }}>＋</span>
        New item
      </button>
    );
  }

  return (
    <div style={{
      background: '#F8FAFC', border: '2px solid #6366F1', borderRadius: 12,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 160, flex: '0 0 auto',
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
        placeholder="Filename in /Builder/ (no .png) *"
        style={{ ...inputStyle, fontSize: '0.6rem' }} />
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

// ─── Service Key Banner ───────────────────────────────────────────────────────

function ServiceKeyBanner({ serviceKey, onSave }: { serviceKey: string; onSave: (k: string) => void }) {
  const [expanded, setExpanded] = useState(!serviceKey);
  const [draft, setDraft] = useState(serviceKey);

  const save = () => {
    const trimmed = draft.trim();
    localStorage.setItem('admin-service-key', trimmed);
    onSave(trimmed);
    if (trimmed) setExpanded(false);
  };

  const clear = () => {
    localStorage.removeItem('admin-service-key');
    setDraft('');
    onSave('');
    setExpanded(true);
  };

  return (
    <div style={{
      background: serviceKey ? '#F0FDF4' : '#FFFBEB',
      border: `1px solid ${serviceKey ? '#86EFAC' : '#FCD34D'}`,
      borderRadius: 10, padding: '10px 16px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: serviceKey ? '#166534' : '#92400E', fontWeight: 600 }}>
          {serviceKey ? '🟢 Service Key activa' : '🟡 Service Key no configurada'}
        </span>
        {!serviceKey && (
          <span style={{ fontSize: 12, color: '#92400E' }}>
            — necesaria para ver todos los usuarios y cambiar contraseñas
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setExpanded(e => !e)}
            style={{ ...btnStyle, padding: '3px 10px', fontSize: 11, background: '#E2E8F0', color: '#475569' }}>
            {expanded ? 'Ocultar' : 'Configurar'}
          </button>
          {serviceKey && (
            <button onClick={clear}
              style={{ ...btnStyle, padding: '3px 10px', fontSize: 11, background: '#FEE2E2', color: '#EF4444' }}>
              Limpiar
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#78350F', marginBottom: 6 }}>
            Supabase Dashboard → Project Settings → API → <strong>service_role</strong> key.
            Solo se guarda localmente en este navegador (nunca se envía a ningún servidor).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
            />
            <button onClick={save} disabled={!draft.trim()}
              style={{ ...btnStyle, background: '#D97706', color: '#fff' }}>
              {serviceKey ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SEO Tab ─────────────────────────────────────────────────────────────────

interface SeoForm { meta_title: string; meta_description: string; og_image_url: string; google_site_verification: string; }

function SeoTab() {
  const [form, setForm] = useState<SeoForm>({ meta_title: '', meta_description: '', og_image_url: '', google_site_verification: '' });
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('site_settings').select('key, value').then(({ data }) => {
      if (data) {
        const m = Object.fromEntries((data as { key: string; value: string }[]).map(r => [r.key, r.value]));
        setForm({
          meta_title:              m.meta_title              ?? '',
          meta_description:        m.meta_description        ?? '',
          og_image_url:            m.og_image_url            ?? '',
          google_site_verification: m.google_site_verification ?? '',
        });
      }
      setStatus('idle');
    });
  }, []);

  const set = (k: keyof SeoForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const ext  = file.name.split('.').pop();
    const path = `og-image.${ext}`;
    const { error } = await supabase.storage.from('seo-assets').upload(path, file, { upsert: true });
    if (error) {
      setUploadError('Error al subir. Verificá que el bucket "seo-assets" existe y es público en Supabase Storage.');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('seo-assets').getPublicUrl(path);
    setForm(f => ({ ...f, og_image_url: data.publicUrl }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    setStatus('saving');
    const rows = Object.entries(form).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
    setStatus(error ? 'error' : 'saved');
    if (!error) setTimeout(() => setStatus('idle'), 2000);
  };

  const fw: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 };
  const fl: React.CSSProperties  = { fontSize: 13, fontWeight: 600, color: '#1E293B' };
  const fn: React.CSSProperties  = { fontSize: 11, color: '#94A3B8' };
  const fi: React.CSSProperties  = { ...{ border:'1px solid #E2E8F0', borderRadius:6, fontFamily:'Outfit,sans-serif',
    boxSizing:'border-box' as const, outline:'none', width:'100%' }, padding:'8px 10px', fontSize:'0.875rem' };

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 16, color: '#1E293B' }}>SEO &amp; Social</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748B' }}>
        Controlá cómo aparece el juego en Google y al compartirlo por WhatsApp, LinkedIn o Twitter.
      </p>
      {status === 'loading' ? <p style={{ color: '#94A3B8' }}>Cargando…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={fw}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={fl}>Meta Title</span>
              <span style={{ ...fn, color: form.meta_title.length > 60 ? '#EF4444' : '#94A3B8' }}>
                {form.meta_title.length}/60
              </span>
            </div>
            <input value={form.meta_title} onChange={set('meta_title')} maxLength={70}
              placeholder="CityHero Academy" style={fi} />
            <span style={fn}>Título de la pestaña del navegador y resultado en Google.</span>
          </div>

          <div style={fw}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={fl}>Meta Description</span>
              <span style={{ ...fn, color: form.meta_description.length > 155 ? '#EF4444' : '#94A3B8' }}>
                {form.meta_description.length}/155
              </span>
            </div>
            <textarea value={form.meta_description} onChange={set('meta_description')}
              maxLength={180} rows={3}
              placeholder="Juego educativo de ciudad para niños de 5 a 8 años…"
              style={{ ...fi, resize: 'vertical', lineHeight: 1.5 }} />
            <span style={fn}>Resumen que muestra el buscador bajo el link del resultado.</span>
          </div>

          <div style={fw}>
            <span style={fl}>OG Image</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.og_image_url} onChange={set('og_image_url')} type="url"
                placeholder="https://cityheroacademy.com/ImageforSEO.jpg" style={{ ...fi, flex: 1 }} />
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleImageUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ ...btnStyle, background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0',
                  whiteSpace: 'nowrap', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Subiendo…' : '📁 Explorar'}
              </button>
            </div>
            <span style={fn}>Imagen al compartir por WhatsApp / LinkedIn / Twitter (recomendado: 1200×630 px).</span>
            {uploadError && <span style={{ ...fn, color: '#EF4444' }}>{uploadError}</span>}
            {form.og_image_url && (
              <img src={form.og_image_url} alt="OG preview"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{ marginTop: 6, maxWidth: 320, borderRadius: 8, border: '1px solid #E2E8F0' }} />
            )}
          </div>

          <div style={fw}>
            <span style={fl}>Google Site Verification Token</span>
            <input value={form.google_site_verification} onChange={set('google_site_verification')}
              placeholder="Pegá aquí el token de Google Search Console"
              style={fi} />
            <span style={fn}>Se inyecta como <code>{'<meta name="google-site-verification">'}</code> en el head. Dejalo vacío si no lo necesitás.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={save} disabled={status === 'saving'} style={{
              ...btnStyle, background: '#6366F1', color: '#fff',
              opacity: status === 'saving' ? 0.7 : 1,
            }}>
              {status === 'saving' ? 'Guardando…' : status === 'saved' ? '✓ Guardado' : 'Guardar cambios'}
            </button>
            {status === 'error' && (
              <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>
                Error al guardar. Verificá los permisos de la tabla <code>site_settings</code> en Supabase.
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

interface CountryRow { pais_residencia: string | null; count: number }
interface Stats {
  total: number;
  newInPeriod: number;
  activeInPeriod: number;
  countries: CountryRow[];
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function AnalyticsTab({ adminClient }: { adminClient: AdminClient | null }) {
  const db = adminClient ?? supabase;
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo]     = useState(todayStr());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true); setError('');
    try {
      const fromTs = `${from}T00:00:00.000Z`;
      const toTs   = `${to}T23:59:59.999Z`;

      const { data: allData, error: e1 } = await db
        .from('perfiles_usuarios').select('id');
      if (e1) throw e1;
      const total = allData?.length ?? 0;

      const { data: newData, error: e2 } = await db
        .from('perfiles_usuarios').select('id')
        .gte('created_at', fromTs).lte('created_at', toTs);
      if (e2) throw e2;
      const newIn = newData?.length ?? 0;

      const { data: activeData, error: e3 } = await db
        .from('perfiles_usuarios').select('id')
        .gte('last_active', fromTs).lte('last_active', toTs);
      if (e3) throw e3;
      const activeIn = activeData?.length ?? 0;

      const { data: countryRows, error: e4 } = await db
        .from('perfiles_usuarios').select('pais_residencia')
        .gte('created_at', fromTs).lte('created_at', toTs);
      if (e4) throw e4;

      const countryMap: Record<string, number> = {};
      (countryRows ?? []).forEach((r: { pais_residencia: string | null }) => {
        const c = r.pais_residencia || 'Unknown';
        countryMap[c] = (countryMap[c] || 0) + 1;
      });
      const countries: CountryRow[] = Object.entries(countryMap)
        .map(([pais_residencia, count]) => ({ pais_residencia, count }))
        .sort((a, b) => b.count - a.count);

      setStats({ total, newInPeriod: newIn, activeInPeriod: activeIn, countries });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
      setError(`Error al obtener datos: ${msg}`);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [adminClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxCountry = stats ? Math.max(...stats.countries.map(c => c.count), 1) : 1;

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#1E293B' }}>Analytics</h2>

      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '16px 20px', marginBottom: 24,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div>
          <label style={fieldLabel}>DESDE</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <label style={fieldLabel}>HASTA</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ ...inputStyle, width: 150 }} />
        </div>
        <button onClick={fetchStats} disabled={loading}
          style={{ ...btnStyle, background: '#6366F1', color: '#fff', height: 34 }}>
          {loading ? 'Cargando…' : 'Aplicar'}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Usuarios" value={stats.total} icon="👥" color="#6366F1" note="todos los tiempos" />
            <StatCard label="Nuevos Usuarios" value={stats.newInPeriod} icon="🆕" color="#10B981"
              note={`${from} → ${to}`} />
            <StatCard label="Usuarios Activos" value={stats.activeInPeriod} icon="🎮" color="#F59E0B"
              note="last_active en el período" />
          </div>

          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#1E293B' }}>
              🌍 Países — nuevos usuarios en el período
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400, marginLeft: 8 }}>
                ({stats.countries.length} países, {stats.newInPeriod} usuarios)
              </span>
            </h3>
            {stats.countries.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13 }}>Sin datos para este período.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.countries.map(({ pais_residencia, count }) => {
                  const pct = Math.round((count / maxCountry) * 100);
                  return (
                    <div key={pais_residencia ?? 'unknown'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{pais_residencia || 'Unknown'}</span>
                        <span style={{ color: '#64748B' }}>{count} usuario{count !== 1 ? 's' : ''}</span>
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

// ─── Users Tab ────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  username: string;
  pais_residencia: string | null;
  monedas: number;
  created_at: string | null;
  last_active: string | null;
  progreso_juegos: {
    cityPoints?: number;
    highScores?: Record<string, number>;
    highestLevel?: Record<string, number>;
    streakDays?: number;
    lastLoginDate?: string;
  };
}

function UsersTab({ adminClient }: { adminClient: AdminClient | null }) {
  const db = adminClient ?? supabase;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    username: '', pais_residencia: '', monedas: 0, newPassword: '',
  });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true); setError('');
    const { data, error: e } = await db
      .from('perfiles_usuarios')
      .select('id, username, pais_residencia, monedas, created_at, last_active, progreso_juegos')
      .order('username');
    if (e) setError(`Error: ${e.message}`);
    else setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [adminClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (u: UserRow) => {
    setEditId(u.id);
    setSaveMsg('');
    setEditDraft({
      username: u.username,
      pais_residencia: u.pais_residencia ?? '',
      monedas: u.monedas,
      newPassword: '',
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true); setSaveMsg('');
    try {
      const { error: e1 } = await db.from('perfiles_usuarios')
        .update({
          username: editDraft.username.trim(),
          pais_residencia: editDraft.pais_residencia.trim(),
          monedas: editDraft.monedas,
        })
        .eq('id', editId);
      if (e1) throw new Error(e1.message);

      if (editDraft.newPassword.trim()) {
        if (!adminClient) throw new Error('La Service Key es necesaria para cambiar contraseñas');
        const { error: e2 } = await adminClient.auth.admin.updateUserById(
          editId, { password: editDraft.newPassword.trim() }
        );
        if (e2) throw new Error(e2.message);
      }

      setUsers(prev => prev.map(u => u.id === editId ? {
        ...u,
        username: editDraft.username.trim(),
        pais_residencia: editDraft.pais_residencia.trim(),
        monedas: editDraft.monedas,
      } : u));
      setSaveMsg('✓ Guardado');
      setTimeout(() => { setEditId(null); setSaveMsg(''); }, 1200);
    } catch (e: unknown) {
      setSaveMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    setSaving(false);
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.pais_residencia ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const progressSummary = (u: UserRow) => {
    const hl = u.progreso_juegos?.highestLevel ?? {};
    const parts = Object.entries(GAME_LABEL)
      .map(([id, lbl]) => (hl[id] ?? 0) > 0 ? `${lbl[0]}:${hl[id]}` : null)
      .filter(Boolean);
    return parts.length ? parts.join(' ') : '—';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: '#1E293B' }}>
          Usuarios ({loading ? '…' : filtered.length}
          {filtered.length !== users.length ? ` / ${users.length}` : ''})
        </h2>
        <button onClick={fetchUsers} disabled={loading}
          style={{ ...btnStyle, background: '#6366F1', color: '#fff' }}>
          {loading ? 'Cargando…' : '↻ Actualizar'}
        </button>
      </div>

      {!adminClient && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400E',
        }}>
          ⚠️ Sin Service Key solo verás tus propios datos. Configura la Service Key arriba para ver todos los usuarios.
        </div>
      )}

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8,
          padding: '8px 12px', color: '#EF4444', fontSize: 13, marginBottom: 12,
        }}>{error}</div>
      )}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Buscar por usuario o país…"
        style={{ ...inputStyle, marginBottom: 14, fontSize: 13, padding: '8px 12px' }}
      />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              {['#', 'Usuario', 'País', 'CityCoins', 'CP', 'Streak', 'Progreso (nivel máx.)', 'Registro', 'Último acceso', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                  color: '#475569', fontSize: 11, whiteSpace: 'nowrap',
                  borderBottom: '1px solid #E2E8F0',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                  {users.length === 0
                    ? 'Sin usuarios. ¿Está configurada la Service Key?'
                    : 'Sin resultados para la búsqueda.'}
                </td>
              </tr>
            )}
            {filtered.map((u, i) => {
              const isEditing = editId === u.id;
              const prog = u.progreso_juegos ?? {};
              return (
                <React.Fragment key={u.id}>
                  <tr style={{
                    background: isEditing ? '#EEF2FF' : (i % 2 === 0 ? '#fff' : '#F8FAFC'),
                    borderBottom: isEditing ? 'none' : '1px solid #E2E8F0',
                  }}>
                    <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{u.username}</td>
                    <td style={{ padding: '8px 10px' }}>{u.pais_residencia || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>💰 {u.monedas.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{prog.cityPoints ?? 0}</td>
                    <td style={{ padding: '8px 10px' }}>{prog.streakDays ?? 0}d</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                      {progressSummary(u)}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {u.created_at ? u.created_at.slice(0, 10) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {u.last_active ? u.last_active.slice(0, 10) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {isEditing ? (
                        <button onClick={() => setEditId(null)}
                          style={{ ...btnStyle, padding: '3px 8px', fontSize: 11, background: '#E2E8F0', color: '#64748B' }}>
                          Cancelar
                        </button>
                      ) : (
                        <button onClick={() => startEdit(u)}
                          style={{ ...btnStyle, padding: '3px 8px', fontSize: 11, background: '#6366F1', color: '#fff' }}>
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>

                  {isEditing && (
                    <tr style={{ background: '#EEF2FF', borderBottom: '2px solid #6366F1' }}>
                      <td colSpan={10} style={{ padding: '14px 16px' }}>
                        {/* Edit fields */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                          <div>
                            <label style={fieldLabel}>Usuario</label>
                            <input value={editDraft.username}
                              onChange={e => setEditDraft(d => ({ ...d, username: e.target.value }))}
                              style={{ ...inputStyle, width: 160 }} />
                          </div>
                          <div>
                            <label style={fieldLabel}>País</label>
                            <input value={editDraft.pais_residencia}
                              onChange={e => setEditDraft(d => ({ ...d, pais_residencia: e.target.value }))}
                              style={{ ...inputStyle, width: 120 }} />
                          </div>
                          <div>
                            <label style={fieldLabel}>CityCoins</label>
                            <input type="number" min={0} value={editDraft.monedas}
                              onChange={e => setEditDraft(d => ({ ...d, monedas: Number(e.target.value) }))}
                              style={{ ...inputStyle, width: 100 }} />
                          </div>
                          <div>
                            <label style={fieldLabel}>
                              Nueva contraseña{!adminClient && ' (requiere Service Key)'}
                            </label>
                            <input
                              type="text"
                              value={editDraft.newPassword}
                              onChange={e => setEditDraft(d => ({ ...d, newPassword: e.target.value }))}
                              placeholder={adminClient ? 'Dejar vacío para no cambiar' : 'Configura la Service Key primero'}
                              disabled={!adminClient}
                              style={{ ...inputStyle, width: 200, opacity: adminClient ? 1 : 0.5 }}
                            />
                          </div>
                          <button onClick={saveEdit} disabled={saving}
                            style={{ ...btnStyle, background: '#6366F1', color: '#fff' }}>
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                          {saveMsg && (
                            <span style={{
                              fontSize: 13, fontWeight: 600,
                              color: saveMsg.startsWith('✓') ? '#10B981' : '#EF4444',
                            }}>{saveMsg}</span>
                          )}
                        </div>

                        {/* Game progress details */}
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #C7D2FE' }}>
                          <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 700, marginBottom: 8 }}>
                            Progreso por juego:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {Object.entries(GAME_LABEL).map(([id, name]) => {
                              const level = (prog.highestLevel ?? {})[id] ?? 0;
                              const score = (prog.highScores ?? {})[id] ?? 0;
                              return (
                                <div key={id} style={{
                                  background: '#fff', border: '1px solid #C7D2FE', borderRadius: 8,
                                  padding: '8px 12px', fontSize: 12, minWidth: 90, textAlign: 'center',
                                }}>
                                  <div style={{ fontWeight: 700, color: '#4F46E5', marginBottom: 2 }}>{name}</div>
                                  <div style={{ color: '#334155' }}>Nivel {level}/20</div>
                                  <div style={{ color: '#94A3B8', fontSize: 11 }}>Best: {score}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>
                            * Tiempo jugado por día no está disponible en el modelo de datos actual (no se registra).
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const navigate = useNavigate();
  const store = useAdminStore();

  const [tab, setTab] = useState<Tab>('missions');
  const [serviceKey, setServiceKey] = useState(() => localStorage.getItem('admin-service-key') ?? '');

  const adminClient = useMemo<AdminClient | null>(() => {
    if (!serviceKey.trim()) return null;
    return createClient(SUPABASE_URL, serviceKey.trim(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }, [serviceKey]);

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
    if (!confirm('¿Resetear todos los ajustes admin a los valores por defecto? Esto no se puede deshacer.')) return;
    store.resetAll();
    window.location.reload();
  };

  const needsServiceKey = tab === 'analytics' || tab === 'users';

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
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        display: 'flex', padding: '0 20px', overflowX: 'auto',
      }}>
        {([
          ['missions',  '🗺️ Misiones'],
          ['builder',   '🏗️ City Builder'],
          ['analytics', '📊 Analytics'],
          ['users',     '👥 Usuarios'],
          ['seo',       '🔍 SEO'],
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

      <div style={{
        padding: '24px 20px',
        maxWidth: tab === 'users' ? 1100 : 800,
        margin: '0 auto',
      }}>

        {/* Service Key Banner (only for tabs that need DB reads) */}
        {needsServiceKey && (
          <ServiceKeyBanner serviceKey={serviceKey} onSave={setServiceKey} />
        )}

        {/* ── MISSIONS TAB ─────────────────────────────────────────────────── */}
        {tab === 'missions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: '#1E293B' }}>Nombres de Misiones</h2>
              <button onClick={saveMissions} style={{ ...btnStyle, background: '#6366F1', color: '#fff' }}>
                {missionSaved ? '✓ Guardado!' : 'Guardar cambios'}
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
                  {builderSaved ? '✓ Guardado!' : 'Guardar cambios'}
                </button>
              </div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8' }}>
              W = columnas a la derecha, D = columnas a la izquierda (huella isométrica).
              Las imágenes deben existir en <code>/Builder/</code> en el servidor.
            </p>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {cats.map((cat, i) => (
                <button key={i} onClick={() => setActiveCat(i)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: activeCat === i ? '2px solid #6366F1' : '2px solid #E2E8F0',
                  background: activeCat === i ? '#EEF2FF' : '#fff',
                  color: activeCat === i ? '#6366F1' : '#64748B',
                  cursor: 'pointer', fontSize: 13, fontWeight: activeCat === i ? 700 : 400,
                }}>
                  {cat.emoji} {cat.label}{' '}
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>({cat.items.length})</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
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
              Los cambios son locales hasta hacer clic en <strong>Guardar cambios</strong>.
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ────────────────────────────────────────────────── */}
        {tab === 'analytics' && <AnalyticsTab adminClient={adminClient} />}

        {/* ── USERS TAB ────────────────────────────────────────────────────── */}
        {tab === 'users' && <UsersTab adminClient={adminClient} />}

        {/* ── SEO TAB ──────────────────────────────────────────────────────── */}
        {tab === 'seo' && <SeoTab />}

        {/* ── DANGER ZONE ──────────────────────────────────────────────────── */}
        <div style={{ marginTop: 40, borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, color: '#94A3B8' }}>Zona de peligro</h3>
          <button onClick={resetAll}
            style={{ ...btnStyle, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5' }}>
            Resetear TODOS los ajustes admin a los valores por defecto
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

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#6366F1',
  fontWeight: 700,
  marginBottom: 3,
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
