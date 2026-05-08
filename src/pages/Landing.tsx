import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface SubstackPost {
  id: number;
  title: string;
  subtitle?: string;
  cover_image?: string | null;
  post_date: string;
  canonical_url: string;
}

const FF = 'Fredoka One, cursive';

const MISSIONS = [
  { icon: '🗑️', title: 'Keeping the City Clean',       desc: 'Slingshot trash into the right bins across 20 levels of recycling challenges.',     color: '#22C55E', bg: '#F0FDF4' },
  { icon: '🚶', title: 'Crossing the Right Way',        desc: 'Learn road safety by helping characters cross at the right time and place.',          color: '#3B82F6', bg: '#EFF6FF' },
  { icon: '💡', title: 'Energy Responsibility',         desc: 'Turn off lights in empty rooms and build planet-saving habits through play.',         color: '#EAB308', bg: '#FEFCE8' },
  { icon: '💧', title: 'Water Saver',                   desc: 'Race to shut leaking faucets before precious water is wasted.',                       color: '#06B6D4', bg: '#ECFEFF' },
  { icon: '🐕', title: 'Not My Dog, Still My Job',      desc: 'Navigate mazes and help stray animals find their way home safely.',                  color: '#8B5CF6', bg: '#F5F3FF' },
  { icon: '🚲', title: 'Biking My City',                desc: 'Design bike routes across the city, placing street pieces and dodging obstacles.',    color: '#F97316', bg: '#FFF7ED' },
];

const SUBSTACK_BASE = 'https://cityheroacademy.substack.com';

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function Wave({ fromColor, toColor }: { fromColor: string; toColor: string }) {
  return (
    <div style={{ background: fromColor, lineHeight: 0, display: 'block' }}>
      <svg viewBox="0 0 1200 70" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 56 }}>
        <path d="M0,35 C300,70 900,0 1200,35 L1200,70 L0,70 Z" fill={toColor} />
      </svg>
    </div>
  );
}

function SectionLabel({ text, color = '#3B82F6', bg = '#EFF6FF' }: { text: string; color?: string; bg?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 14 }}>
      <span style={{
        fontFamily: FF, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase',
        color, background: bg, borderRadius: 99, padding: '4px 16px',
      }}>
        {text}
      </span>
    </div>
  );
}

function AppBadge({ platform, large, comingSoon }: { platform: 'App Store' | 'Google Play'; large?: boolean; comingSoon?: boolean }) {
  const icon  = platform === 'App Store' ? '🍎' : '🤖';
  const label = comingSoon ? 'Coming Soon' : `Download on`;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      background: comingSoon ? 'rgba(255,255,255,0.12)' : '#000',
      border: comingSoon ? '1.5px solid rgba(255,255,255,0.28)' : 'none',
      borderRadius: 14, padding: large ? '10px 22px' : '7px 14px',
      opacity: comingSoon ? 0.82 : 1, cursor: comingSoon ? 'default' : 'pointer',
    }}>
      <span style={{ fontSize: large ? '1.7rem' : '1.3rem', lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{label}</div>
        <div style={{ fontFamily: FF, fontSize: large ? '1rem' : '0.8rem', color: '#fff', lineHeight: 1.3 }}>{platform}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const goPlay   = () => navigate('/play');

  const [posts, setPosts]       = useState<SubstackPost[] | null>(null);
  const [postsErr, setPostsErr] = useState(false);

  useEffect(() => {
    // /api/posts is a Cloudflare Pages Function that proxies Substack server-side
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: SubstackPost[]) => setPosts(data.slice(0, 3)))
      .catch(() => setPostsErr(true));
  }, []);

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', overflowX: 'hidden', background: '#fff' }}>

      {/* ── Sticky nav ───────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        borderBottom: '1px solid #F1F5F9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/Logo_CHA.png" alt="CityHero Academy" style={{ height: 38, display: 'block' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href={SUBSTACK_BASE}
            target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: FF, fontSize: '0.85rem', color: '#475569', textDecoration: 'none' }}
          >
            Blog
          </a>
          <button
            onClick={goPlay}
            style={{
              fontFamily: FF, fontSize: '0.92rem', color: '#fff',
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              border: 'none', borderRadius: 99, padding: '8px 22px',
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
            }}
          >
            🎮 Play Free
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(155deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
        padding: 'clamp(60px,10vw,100px) 24px clamp(80px,12vw,120px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative blobs */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ position:'absolute', bottom:0, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />

        <div style={{ position:'relative', zIndex:1, maxWidth:620, margin:'0 auto' }}>

          {/* badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)',
            borderRadius:99, padding:'6px 18px', marginBottom:28,
          }}>
            <span style={{ color:'#FCD34D', fontFamily:FF, fontSize:'0.82rem' }}>
              🌍 Free · Ages 5–10 · No Ads · No Account Needed
            </span>
          </div>

          <h1 style={{
            fontFamily: FF,
            fontSize: 'clamp(1.9rem, 6vw, 3.2rem)',
            color: '#fff', lineHeight: 1.15, marginBottom: 20,
            textShadow: '0 4px 24px rgba(0,0,0,0.25)',
          }}>
            Making Good Citizens,<br />One Adventure at a Time 🚀
          </h1>

          <p style={{
            fontSize: 'clamp(0.95rem, 2.5vw, 1.12rem)',
            color: 'rgba(255,255,255,0.88)', lineHeight: 1.75,
            maxWidth: 500, margin: '0 auto 40px',
          }}>
            CityHero Academy is a free educational game where children ages 5–10
            complete 6 real city missions — learning civic responsibility, sustainability,
            and empathy through interactive play.
          </p>

          {/* floating character */}
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            style={{ marginBottom: 40 }}
          >
            <div style={{
              width: 110, height: 110, borderRadius: '50%', margin: '0 auto',
              background: 'linear-gradient(135deg,#FFD93D,#FF8C42)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3.6rem',
              border: '5px solid rgba(255,255,255,0.7)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.28), 0 0 0 12px rgba(253,211,77,0.15)',
            }}>
              👦
            </div>
          </motion.div>

          {/* CTAs */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={goPlay}
              style={{
                fontFamily: FF, fontSize: 'clamp(1rem,3vw,1.18rem)', color: '#fff',
                background: 'linear-gradient(180deg,#22C55E 0%,#15803D 100%)',
                border: 'none', borderRadius: 99,
                padding: 'clamp(14px,2vw,18px) clamp(36px,6vw,60px)',
                cursor: 'pointer',
                boxShadow: '0 8px 0 #14532D, 0 14px 32px rgba(21,128,61,0.5)',
                width: '100%', maxWidth: 340,
              }}
            >
              🎮 Play Now — It's Free!
            </motion.button>

            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              <AppBadge platform="App Store" comingSoon />
              <AppBadge platform="Google Play" comingSoon />
            </div>
          </div>
        </div>
      </section>

      <Wave fromColor="#2563EB" toColor="#F8FAFF" />

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section style={{ background:'#F8FAFF', padding:'52px 24px' }}>
        <div style={{
          display:'flex', flexWrap:'wrap', justifyContent:'center', gap:20,
          maxWidth:760, margin:'0 auto',
        }}>
          {[
            { n:'5–10',  label:'Years old',    emoji:'🧒' },
            { n:'6',    label:'Missions',      emoji:'🏙️' },
            { n:'120+', label:'Game levels',   emoji:'⭐' },
            { n:'100%', label:'Free, no ads',  emoji:'🎁' },
          ].map(({ n, label, emoji }) => (
            <div key={label} style={{
              background:'#fff', borderRadius:20, padding:'22px 28px',
              textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,0.06)',
              flex:'1 1 130px', minWidth:120,
            }}>
              <div style={{ fontSize:'1.8rem', marginBottom:6 }}>{emoji}</div>
              <div style={{ fontFamily:FF, fontSize:'2rem', color:'#1E3A8A', lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:'0.82rem', color:'#64748B', marginTop:6 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <Wave fromColor="#F8FAFF" toColor="#fff" />

      {/* ── Missions ─────────────────────────────────────────────────────── */}
      <section style={{ background:'#fff', padding:'64px 24px 80px' }}>
        <div style={{ maxWidth:840, margin:'0 auto' }}>
          <SectionLabel text="The Missions" />
          <h2 style={{ fontFamily:FF, fontSize:'clamp(1.6rem,5vw,2.2rem)', color:'#1E3A8A', textAlign:'center', marginBottom:12 }}>
            6 Adventures Across the City
          </h2>
          <p style={{ textAlign:'center', color:'#64748B', maxWidth:460, margin:'0 auto 48px', lineHeight:1.7 }}>
            Each mission teaches a real civic value through gameplay built for curious young minds.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:20 }}>
            {MISSIONS.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity:0, y:24 }}
                whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y:-5 }}
                style={{
                  background: m.bg, borderRadius:22, padding:'26px 22px',
                  border:`2px solid ${m.color}28`,
                  boxShadow:`0 4px 20px ${m.color}14`,
                }}
              >
                <div style={{
                  width:54, height:54, borderRadius:16, marginBottom:16,
                  background: m.color + '22',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.9rem',
                }}>
                  {m.icon}
                </div>
                <div style={{ fontFamily:FF, fontSize:'0.78rem', color:m.color, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  Mission {i + 1}
                </div>
                <div style={{ fontFamily:FF, fontSize:'1.08rem', color:'#0F172A', marginBottom:10, lineHeight:1.3 }}>
                  {m.title}
                </div>
                <p style={{ fontSize:'0.85rem', color:'#64748B', lineHeight:1.6, margin:0 }}>
                  {m.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <div style={{ textAlign:'center', marginTop:52 }}>
            <motion.button
              whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}
              onClick={goPlay}
              style={{
                fontFamily:FF, fontSize:'1.08rem', color:'#fff',
                background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                border:'none', borderRadius:99, padding:'14px 44px',
                cursor:'pointer', boxShadow:'0 6px 0 #1E40AF, 0 10px 24px rgba(59,130,246,0.4)',
              }}
            >
              Start Playing — Free! 🎮
            </motion.button>
          </div>
        </div>
      </section>

      <Wave fromColor="#fff" toColor="#F0FDF4" />

      {/* ── Why CityHero ─────────────────────────────────────────────────── */}
      <section style={{ background:'#F0FDF4', padding:'72px 24px' }}>
        <div style={{ maxWidth:840, margin:'0 auto' }}>
          <SectionLabel text="Why It Matters" color="#16A34A" bg="#DCFCE7" />
          <h2 style={{ fontFamily:FF, fontSize:'clamp(1.6rem,5vw,2.2rem)', color:'#14532D', textAlign:'center', marginBottom:52 }}>
            Learning That Actually Sticks
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:24 }}>
            {[
              { icon:'🧠', title:'Learning Through Play',   desc:'Research shows children retain up to 75% more when learning through interactive play versus passive content or worksheets.' },
              { icon:'🏙️', title:'Real City Skills',        desc:'Every mission maps to a real civic behavior — road safety, recycling, conserving energy — that kids can practice in daily life.' },
              { icon:'❤️', title:'Empathy & Community',     desc:'Players discover that small individual actions create ripple effects for the entire city — building a sense of responsibility from day one.' },
              { icon:'🌍', title:'Aligned with the SDGs',   desc:'Content covers key UN Sustainable Development Goals, making CityHero Academy a natural fit for global civic education initiatives.' },
            ].map(({ icon, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }}
                style={{
                  background:'#fff', borderRadius:22, padding:'28px 24px',
                  boxShadow:'0 4px 20px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize:'2.4rem', marginBottom:18 }}>{icon}</div>
                <div style={{ fontFamily:FF, fontSize:'1.1rem', color:'#0F172A', marginBottom:10 }}>{title}</div>
                <p style={{ fontSize:'0.87rem', color:'#64748B', lineHeight:1.65, margin:0 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Wave fromColor="#F0FDF4" toColor="#fff" />

      {/* ── For (3 audiences) ────────────────────────────────────────────── */}
      <section style={{ background:'#fff', padding:'72px 24px' }}>
        <div style={{ maxWidth:840, margin:'0 auto' }}>
          <SectionLabel text="Who It's For" />
          <h2 style={{ fontFamily:FF, fontSize:'clamp(1.6rem,5vw,2.2rem)', color:'#1E3A8A', textAlign:'center', marginBottom:52 }}>
            Built for the Whole Village
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
            {[
              {
                emoji:'👨‍👩‍👧', title:'For Parents',
                color:'#3B82F6', bg:'#EFF6FF',
                points:[
                  'Completely free — no subscriptions, no in-app purchases',
                  'Safe environment with no ads, no data collection from children',
                  'No account needed — start playing in under 30 seconds',
                  'Builds real habits your child will carry throughout their life',
                ],
              },
              {
                emoji:'👩‍🏫', title:'For Educators & Schools',
                color:'#8B5CF6', bg:'#F5F3FF',
                points:[
                  'Curriculum-aligned civic education across 6 thematic missions',
                  'Each mission is a self-contained learning unit (15–30 min)',
                  'Supports classroom engagement and group activities',
                  'Printable activity sheets and lesson guides — coming soon',
                ],
              },
              {
                emoji:'🏛️', title:'For Governments & NGOs',
                color:'#F97316', bg:'#FFF7ED',
                points:[
                  'A scalable digital tool for city-wide civic education programs',
                  'Covers key Sustainable Development Goals (SDGs 3, 6, 7, 11, 13)',
                  'Adaptable to local city contexts, languages, and challenges',
                  'Partnership and co-branding opportunities available',
                ],
              },
            ].map(({ emoji, title, color, bg, points }) => (
              <motion.div
                key={title}
                initial={{ opacity:0, x:-20 }} whileInView={{ opacity:1, x:0 }}
                viewport={{ once:true }}
                style={{
                  background:bg, borderRadius:24, padding:'30px 28px',
                  border:`2px solid ${color}22`,
                  display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap',
                }}
              >
                <div style={{
                  width:68, height:68, borderRadius:20, flexShrink:0,
                  background: color + '1E',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'2.1rem',
                }}>
                  {emoji}
                </div>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontFamily:FF, fontSize:'1.2rem', color:'#0F172A', marginBottom:16 }}>{title}</div>
                  <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                    {points.map(p => (
                      <li key={p} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                        <span style={{ color, fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>
                        <span style={{ fontSize:'0.88rem', color:'#475569', lineHeight:1.55 }}>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Wave fromColor="#fff" toColor="#F8FAFF" />

      {/* ── Articles / Substack ──────────────────────────────────────────── */}
      <section style={{ background:'#F8FAFF', padding:'72px 24px' }}>
        <div style={{ maxWidth:840, margin:'0 auto' }}>
          <SectionLabel text="From the Blog" />
          <h2 style={{ fontFamily:FF, fontSize:'clamp(1.6rem,5vw,2.2rem)', color:'#1E3A8A', textAlign:'center', marginBottom:12 }}>
            Insights on Civic Education
          </h2>
          <p style={{ textAlign:'center', color:'#64748B', maxWidth:440, margin:'0 auto 48px', lineHeight:1.7 }}>
            Deep dives on urban education, sustainable cities, and the future of civic learning — published on Substack.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:22 }}>

            {/* Loading skeletons */}
            {posts === null && !postsErr && [0,1,2].map(i => (
              <div key={i} style={{
                background:'#fff', borderRadius:22,
                boxShadow:'0 4px 18px rgba(0,0,0,0.07)', overflow:'hidden',
              }}>
                <div style={{ height:160, background:'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)', backgroundSize:'200% 100%',
                  animation:'shimmer 1.4s infinite' }} />
                <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ height:12, background:'#F1F5F9', borderRadius:99, width:'40%' }} />
                  <div style={{ height:16, background:'#F1F5F9', borderRadius:8, width:'90%' }} />
                  <div style={{ height:16, background:'#F1F5F9', borderRadius:8, width:'75%' }} />
                  <div style={{ height:12, background:'#F1F5F9', borderRadius:99, width:'55%' }} />
                </div>
              </div>
            ))}

            {/* Real posts from Substack */}
            {posts && posts.map((post) => (
              <a key={post.id} href={post.canonical_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
                <motion.div
                  whileHover={{ y:-5, boxShadow:'0 18px 44px rgba(59,130,246,0.14)' }}
                  style={{
                    background:'#fff', borderRadius:22, overflow:'hidden',
                    boxShadow:'0 4px 18px rgba(0,0,0,0.07)',
                    display:'flex', flexDirection:'column', height:'100%',
                  }}
                >
                  {/* Cover image */}
                  {post.cover_image ? (
                    <div style={{ height:160, overflow:'hidden', flexShrink:0 }}>
                      <img
                        src={post.cover_image} alt={post.title}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      height:160, flexShrink:0,
                      background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'3.5rem',
                    }}>
                      📝
                    </div>
                  )}

                  <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:10, flex:1 }}>
                    {/* Date */}
                    <div style={{ fontSize:'0.72rem', color:'#94A3B8', fontWeight:600 }}>
                      {new Date(post.post_date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
                    </div>
                    {/* Title */}
                    <div style={{ fontFamily:FF, fontSize:'1rem', color:'#0F172A', lineHeight:1.4, flex:1 }}>
                      {post.title}
                    </div>
                    {/* Subtitle/excerpt */}
                    {post.subtitle && (
                      <p style={{ fontSize:'0.83rem', color:'#64748B', lineHeight:1.6, margin:0,
                        display:'-webkit-box', WebkitLineClamp:3,
                        WebkitBoxOrient:'vertical' as const, overflow:'hidden',
                      }}>
                        {post.subtitle}
                      </p>
                    )}
                    <div style={{ color:'#3B82F6', fontSize:'0.83rem', fontWeight:600, marginTop:4 }}>
                      Read on Substack →
                    </div>
                  </div>
                </motion.div>
              </a>
            ))}

            {/* Fallback if API failed or no posts yet */}
            {postsErr && (
              <div style={{
                gridColumn:'1 / -1', textAlign:'center',
                padding:'40px 24px', color:'#94A3B8',
              }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✍️</div>
                <p style={{ fontFamily:FF, color:'#64748B' }}>Articles coming soon — stay tuned!</p>
              </div>
            )}
          </div>

          <div style={{ textAlign:'center', marginTop:44 }}>
            <a
              href={SUBSTACK_BASE}
              target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily:FF, fontSize:'1rem', color:'#1E3A8A',
                background:'#fff', border:'2px solid #BFDBFE',
                borderRadius:99, padding:'12px 34px',
                cursor:'pointer', textDecoration:'none', display:'inline-block',
                boxShadow:'0 4px 16px rgba(59,130,246,0.1)',
              }}
            >
              View All Articles on Substack →
            </a>
          </div>
        </div>
      </section>

      <Wave fromColor="#F8FAFF" toColor="#FFFBEB" />

      {/* ── Book ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#FFFBEB', padding: '72px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <SectionLabel text="From the Author" color="#B45309" bg="#FEF3C7" />
          <h2 style={{ fontFamily: FF, fontSize: 'clamp(1.6rem,5vw,2.2rem)', color: '#78350F', textAlign: 'center', marginBottom: 48 }}>
            Also by Pablo Pluda
          </h2>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              background: '#fff',
              borderRadius: 28,
              boxShadow: '0 8px 40px rgba(180,83,9,0.10)',
              border: '2px solid #FDE68A',
              display: 'flex', flexWrap: 'wrap',
              overflow: 'hidden',
            }}
          >
            {/* Book cover */}
            <div style={{
              flexShrink: 0, width: 'clamp(180px, 30%, 240px)',
              background: 'linear-gradient(135deg, #FDE68A, #FCA5A5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
              minHeight: 280,
            }}>
              <img
                src="/book_cover.png"
                alt="It's not that hard, buddy"
                style={{
                  width: '100%', maxWidth: 180,
                  borderRadius: 10,
                  boxShadow: '4px 8px 32px rgba(0,0,0,0.22)',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 240, padding: 'clamp(28px,4vw,44px)' }}>
              <div style={{
                fontFamily: FF, fontSize: '0.75rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#B45309', marginBottom: 10,
              }}>
                Children's Book
              </div>
              <h3 style={{
                fontFamily: FF, fontSize: 'clamp(1.3rem,4vw,1.7rem)',
                color: '#78350F', lineHeight: 1.25, marginBottom: 16, marginTop: 0,
              }}>
                "It's Not That Hard, Buddy"
              </h3>
              <p style={{
                fontSize: '0.93rem', color: '#57534E', lineHeight: 1.75,
                margin: '0 0 16px',
              }}>
                A fun and heartfelt book for young readers that shows how everyday
                challenges — the ones that feel SO big — are usually much more
                manageable than they seem. Perfect for children ages 5–10 who are
                learning to face new situations with courage and a smile.
              </p>
              <p style={{
                fontSize: '0.93rem', color: '#57534E', lineHeight: 1.75,
                margin: '0 0 28px',
              }}>
                A great companion to CityHero Academy's message: small actions,
                big impact — and yes, you can do it!
              </p>
              <motion.a
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                href="https://amzn.to/499n3lB"
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  fontFamily: FF, fontSize: '1rem', color: '#fff',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  border: 'none', borderRadius: 99,
                  padding: '13px 32px', cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 6px 0 #92400E, 0 10px 24px rgba(217,119,6,0.35)',
                }}
              >
                📖 Get it on Amazon
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      <Wave fromColor="#FFFBEB" toColor="#1E3A8A" />

      {/* ── App Download ─────────────────────────────────────────────────── */}
      <section style={{
        background:'linear-gradient(135deg,#1E3A8A 0%,#7C3AED 100%)',
        padding:'80px 24px', textAlign:'center',
      }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <motion.div
            animate={{ rotate: [0, 10, -8, 6, 0] }}
            transition={{ repeat:Infinity, duration:4, ease:'easeInOut' }}
            style={{ fontSize:'3.2rem', display:'inline-block', marginBottom:20 }}
          >
            📱
          </motion.div>
          <h2 style={{ fontFamily:FF, fontSize:'clamp(1.6rem,5vw,2.2rem)', color:'#fff', marginBottom:16 }}>
            The App is Coming Soon!
          </h2>
          <p style={{ color:'rgba(255,255,255,0.8)', lineHeight:1.75, maxWidth:400, margin:'0 auto 44px' }}>
            CityHero Academy will be available on iOS and Android. For now, enjoy the full game for free directly in your browser — no download needed.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:40 }}>
            <AppBadge platform="App Store"   large comingSoon />
            <AppBadge platform="Google Play" large comingSoon />
          </div>
          <motion.button
            whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}
            onClick={goPlay}
            style={{
              fontFamily:FF, fontSize:'1.08rem', color:'#1E3A8A',
              background:'#FCD34D', border:'none', borderRadius:99,
              padding:'14px 44px', cursor:'pointer',
              boxShadow:'0 6px 0 #92400E, 0 10px 28px rgba(0,0,0,0.3)',
            }}
          >
            🌐 Play in Browser Now →
          </motion.button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background:'#0F172A', padding:'48px 24px 36px', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
          <img src="/Logo_CHA.png" alt="CityHero Academy" style={{ height: 34, display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
        </div>
        <p style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.5)', maxWidth:420, margin:'0 auto 28px', lineHeight:1.7 }}>
          A free educational platform helping children ages 5–10 become caring, responsible city citizens.
        </p>
        <div style={{ display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap', marginBottom:28 }}>
          {[
            { label:'Play Game',  href:'/play' },
            { label:'Blog',       href:SUBSTACK_BASE },
            { label:'Contact',    href:'mailto:hello@cityheroacademy.com' },
          ].map(({ label, href }) => (
            <a key={label} href={href}
               target={href.startsWith('http') ? '_blank' : undefined}
               rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
               style={{ color:'rgba(255,255,255,0.5)', textDecoration:'none', fontSize:'0.85rem' }}
            >
              {label}
            </a>
          ))}
        </div>
        <p style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.3)', margin:0 }}>
          © 2025 CityHero Academy · Made with ❤️ for cities and their youngest heroes
        </p>
      </footer>
    </div>
  );
}
