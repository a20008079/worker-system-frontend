'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const API = process.env.NEXT_PUBLIC_API_URL || '';
export default function ParentLogin() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    if (!account || !password) { setError('請輸入帳號與密碼'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password, role: 'parent' }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || '帳號或密碼錯誤'); return; }
      localStorage.setItem('token', d.token); localStorage.setItem('role', 'parent');
      router.push('/parent');
    } catch { setError('連線失敗，請稍後再試'); } finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight:'100dvh', background:'#FAFAFA', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans TC',sans-serif", padding:'24px 20px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'); *{box-sizing:border-box;} .ri:focus{outline:none;border-color:#FF6B00!important;} .rb:active{transform:scale(0.98);} .rl:hover{color:#FF6B00;cursor:pointer;}`}</style>
      <div style={{ width:'100%', maxWidth:400, background:'white', borderRadius:24, padding:'40px 32px', boxShadow:'0 4px 40px rgba(0,0,0,0.06)', border:'1px solid #F0F0F0', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#FF6B00,#FF9A3C)' }}/>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <svg width="40" height="40" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom:12 }}><path d="M22 2 C13 2 6 9 6 18 C6 28 22 42 22 42 C22 42 38 28 38 18 C38 9 31 2 22 2Z" fill="#FF6B00"/><circle cx="22" cy="18" r="7" fill="white"/><circle cx="22" cy="18" r="3" fill="#FF6B00"/></svg>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'center' }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:'#111', letterSpacing:-1 }}>Rumi</span>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:700, color:'#FF6B00', letterSpacing:-1 }}>Go</span>
          </div>
          <div style={{ marginTop:8 }}><span style={{ display:'inline-block', background:'#FFF3EC', color:'#FF6B00', fontSize:11, fontWeight:700, letterSpacing:1.5, padding:'4px 12px', borderRadius:6 }}>家長專區</span></div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={{ fontSize:12, fontWeight:700, color:'#888', display:'block', marginBottom:6 }}>手機號碼</label><input className="ri" type="tel" placeholder="09xxxxxxxx" value={account} onChange={e=>setAccount(e.target.value)} style={{ width:'100%', background:'#F7F8FA', border:'1.5px solid #F0F0F0', borderRadius:12, padding:'13px 16px', fontSize:15, color:'#111', fontFamily:"'Noto Sans TC',sans-serif" }}/></div>
          <div><label style={{ fontSize:12, fontWeight:700, color:'#888', display:'block', marginBottom:6 }}>密碼（電話末4碼）</label><input className="ri" type="password" placeholder="••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ width:'100%', background:'#F7F8FA', border:'1.5px solid #F0F0F0', borderRadius:12, padding:'13px 16px', fontSize:15, color:'#111', fontFamily:"'Noto Sans TC',sans-serif" }}/></div>
          {error && <div style={{ background:'#FFF3EC', border:'1px solid #FFD0B0', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#FF4400' }}>{error}</div>}
          <button className="rb" onClick={handleLogin} disabled={loading} style={{ width:'100%', background:loading?'#FFB380':'#FF6B00', color:'white', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, marginTop:4, cursor:loading?'not-allowed':'pointer', fontFamily:"'Noto Sans TC',sans-serif", transition:'background 0.2s' }}>{loading?'登入中...':'查看車輛位置 →'}</button>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'#CCC', marginTop:20, lineHeight:1.6 }}>帳號為手機號碼，密碼為末4碼</p>
      </div>
      <div style={{ marginTop:24, display:'flex', gap:20, fontSize:12, color:'#BBB' }}>
        <span className="rl" onClick={()=>router.push('/driver/login')}>司機登入</span>
        <span>·</span>
        <span className="rl" onClick={()=>router.push('/admin/login')}>管理員登入</span>
      </div>
    </div>
  );
}