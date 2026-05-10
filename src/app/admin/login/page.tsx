'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const API = process.env.NEXT_PUBLIC_API_URL || '';
export default function AdminLogin() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    if (!account || !password) { setError('請輸入帳號與密碼'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password, role: 'admin' }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || '帳號或密碼錯誤'); return; }
      localStorage.setItem('token', d.token); localStorage.setItem('role', 'admin');
      router.push('/admin');
    } catch { setError('連線失敗，請稍後再試'); } finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight:'100dvh', background:'#08090D', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans TC',sans-serif", padding:'24px 20px', position:'relative', overflow:'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'); *{box-sizing:border-box;} .ri:focus{outline:none;border-color:#6C63FF!important;} .rb:active{transform:scale(0.98);} .rl:hover{color:#A78BFA;cursor:pointer;}`}</style>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(108,99,255,0.07),transparent 70%)', top:-150, right:-100, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(108,99,255,0.05),transparent 70%)', bottom:-100, left:-80, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#6C63FF,#A78BFA)' }}/>
      <div style={{ width:'100%', maxWidth:400, background:'rgba(255,255,255,0.02)', borderRadius:24, padding:'40px 32px', border:'1px solid rgba(108,99,255,0.12)', position:'relative' }}>
        <div style={{ position:'absolute', bottom:-40, right:-40, width:130, height:130, borderRadius:'50%', border:'2px solid rgba(108,99,255,0.08)', pointerEvents:'none' }}/>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <svg width="40" height="40" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom:12 }}><path d="M22 2 C13 2 6 9 6 18 C6 28 22 42 22 42 C22 42 38 28 38 18 C38 9 31 2 22 2Z" fill="#6C63FF"/><circle cx="22" cy="18" r="7" fill="#08090D"/><circle cx="22" cy="18" r="3" fill="#6C63FF"/></svg>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'center' }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:'white', letterSpacing:-1 }}>Rumi</span>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:'#6C63FF', letterSpacing:-1 }}>Go</span>
          </div>
          <div style={{ marginTop:8 }}><span style={{ display:'inline-block', background:'rgba(108,99,255,0.1)', color:'#A78BFA', fontSize:11, fontWeight:700, letterSpacing:1.5, padding:'4px 12px', borderRadius:6, border:'1px solid rgba(108,99,255,0.2)' }}>管理後台</span></div>
        </div>
        <div style={{ width:40, height:1, background:'rgba(108,99,255,0.2)', margin:'0 auto 24px' }}/>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:6 }}>管理員帳號</label><input className="ri" type="text" placeholder="admin" value={account} onChange={e=>setAccount(e.target.value)} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(108,99,255,0.15)', borderRadius:12, padding:'13px 16px', fontSize:15, color:'white', fontFamily:"'Noto Sans TC',sans-serif" }}/></div>
          <div><label style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:6 }}>密碼</label><input className="ri" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(108,99,255,0.15)', borderRadius:12, padding:'13px 16px', fontSize:15, color:'white', fontFamily:"'Noto Sans TC',sans-serif" }}/></div>
          {error && <div style={{ background:'rgba(255,80,0,0.08)', border:'1px solid rgba(255,80,0,0.15)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#FF8060' }}>{error}</div>}
          <button className="rb" onClick={handleLogin} disabled={loading} style={{ width:'100%', background:loading?'rgba(108,99,255,0.3)':'#6C63FF', color:'white', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, marginTop:4, cursor:loading?'not-allowed':'pointer', fontFamily:"'Noto Sans TC',sans-serif", transition:'background 0.2s' }}>{loading?'驗證中...':'進入後台 →'}</button>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:20, lineHeight:1.6 }}>🔒 僅限授權人員登入</p>
      </div>
      <div style={{ marginTop:24, display:'flex', gap:20, fontSize:12, color:'rgba(255,255,255,0.25)' }}>
        <span className="rl" onClick={()=>router.push('/parent/login')}>家長登入</span>
        <span>·</span>
        <span className="rl" onClick={()=>router.push('/driver/login')}>司機登入</span>
      </div>
    </div>
  );
}