import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import JSZip from 'jszip';
import { Activity, ArrowDownToLine, ArrowUpRight, Check, CircleHelp, FileArchive, Heart, Instagram, LockKeyhole, RefreshCw, Search, ShieldCheck, Sparkles, Users, UserMinus, UserPlus, X } from 'lucide-react';

type Person = { username: string; timestamp?: number; href?: string };
type Dataset = { followers: Person[]; following: Person[]; pending: Person[]; importedAt: string; fileName: string; audit?: { followingPath: string; followingFileCandidates: number; rawFollowingCount: number; validFollowingCount: number; duplicateFollowingCount: number; invalidFollowingCount: number; oldestFollowingAt?: number; newestFollowingAt?: number } };
type Tab = 'overview' | 'pending' | 'not-following' | 'inactive' | 'mutual' | 'followers-only' | 'archive-extra';
const PROGRESS_KEY = 'social-sweep-progress-v1';
const CURRENT_FOLLOWING_KEY = 'social-sweep-current-following-v1';

function cleanUsername(value: unknown): string {
  if (typeof value !== 'string') return '';
  let candidate = value.trim();
  if (candidate.startsWith('@')) candidate = candidate.slice(1);
  if (candidate.toLowerCase().startsWith('http')) {
    try { candidate = new URL(candidate).pathname; } catch { return ''; }
  }
  candidate = candidate.split('/').filter(Boolean).pop() || candidate;
  if (candidate.startsWith('_u/')) candidate = candidate.slice(3);
  return candidate.toLowerCase();
}
function personFromFollowing(item: any): Person | null {
  const username = cleanUsername(item?.title || item?.string_list_data?.[0]?.value);
  return username ? { username, timestamp: item?.string_list_data?.[0]?.timestamp, href: `https://www.instagram.com/${username}/` } : null;
}
function personFromFollower(item: any): Person | null {
  const entry = (item?.string_list_data || []).find((x: any) => x?.value || x?.href);
  const username = cleanUsername(entry?.value || entry?.href);
  return username ? { username, timestamp: entry?.timestamp, href: `https://www.instagram.com/${username}/` } : null;
}
function personFromPending(item: any): Person | null {
  const labels = item?.label_values || [];
  const userField = labels.find((x: any) => String(x?.label || '').toLocaleLowerCase().includes('kullan'));
  const linkField = labels.find((x: any) => String(x?.label || '').toLocaleLowerCase().includes('url'));
  const direct = item?.string_list_data?.[0]?.value || item?.title;
  const username = cleanUsername(direct || userField?.value || linkField?.value);
  return username ? { username, timestamp: item?.timestamp || item?.string_list_data?.[0]?.timestamp, href: `https://www.instagram.com/${username}/` } : null;
}
function parseUsernames(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map(token => cleanUsername(token)).filter(username => /^[a-z0-9._]{1,30}$/.test(username)))];
}
function uniquePeople(list: Array<Person | null>): Person[] {
  const map = new Map<string, Person>();
  list.forEach(p => { if (p?.username) map.set(p.username, p); });
  return [...map.values()].sort((a, b) => a.username.localeCompare(b.username));
}
function readProgress(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}
const DATA_DB_NAME = 'social-sweep-local';
const DATA_STORE_NAME = 'imports';
function openDataDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATA_DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DATA_STORE_NAME)) request.result.createObjectStore(DATA_STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Yerel veri deposu açılamadı.'));
  });
}
async function saveDatasetLocally(dataset: Dataset): Promise<void> {
  const db = await openDataDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DATA_STORE_NAME, 'readwrite');
    tx.objectStore(DATA_STORE_NAME).put(dataset, 'latest');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Arşiv yerel olarak kaydedilemedi.'));
    tx.onabort = () => reject(tx.error || new Error('Arşiv kaydı iptal edildi.'));
  });
  db.close();
}
async function loadDatasetLocally(): Promise<Dataset | null> {
  const db = await openDataDb();
  const value = await new Promise<Dataset | null>((resolve, reject) => {
    const tx = db.transaction(DATA_STORE_NAME, 'readonly');
    const request = tx.objectStore(DATA_STORE_NAME).get('latest');
    request.onsuccess = () => resolve((request.result as Dataset | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Kayıtlı arşiv okunamadı.'));
  });
  db.close();
  return value;
}
function formatDate(timestamp?: number) {
  if (!timestamp) return 'Tarih bilgisi yok';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(timestamp * 1000));
}

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<Record<string, string[]>>(readProgress);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [liveFollowingCount, setLiveFollowingCount] = useState('');
  const [currentFollowingText, setCurrentFollowingText] = useState(() => localStorage.getItem(CURRENT_FOLLOWING_KEY) || '');
  const [currentFollowing, setCurrentFollowing] = useState<string[]>(() => parseUsernames(localStorage.getItem(CURRENT_FOLLOWING_KEY) || ''));

  useEffect(() => {
    let active = true;
    loadDatasetLocally().then(saved => {
      if (!active) return;
      if (saved) { setData(saved); setNotice('Önceki Instagram arşivin bu tarayıcıdan geri yüklendi. Yeniden ZIP yüklemene gerek yok.'); }
    }).catch(() => {
      if (active) setNotice('Önceki arşiv geri yüklenemedi. ZIP dosyanı yeniden yükleyebilirsin.');
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);

  const followingSet = useMemo(() => new Set((data?.following || []).map(x => x.username)), [data]);
  const currentFollowingSet = useMemo(() => new Set(currentFollowing), [currentFollowing]);
  const archiveOnly = useMemo(() => currentFollowingSet.size ? (data?.following || []).filter(x => !currentFollowingSet.has(x.username)) : [], [data, currentFollowingSet]);
  const followerSet = useMemo(() => new Set((data?.followers || []).map(x => x.username)), [data]);
  const inactiveSet = new Set(progress.inactive || []);
  const inactiveAccounts = useMemo(() => (data?.following || []).filter(x => inactiveSet.has(x.username)), [data, progress.inactive]);
  const notFollowing = useMemo(() => (data?.following || []).filter(x => !followerSet.has(x.username) && !inactiveSet.has(x.username)), [data, followerSet, progress.inactive]);
  const mutual = useMemo(() => (data?.following || []).filter(x => followerSet.has(x.username)), [data, followerSet]);
  const followersOnly = useMemo(() => (data?.followers || []).filter(x => !followingSet.has(x.username)), [data, followingSet]);
  const donePending = new Set(progress.pending || []);
  const doneUnfollow = new Set(progress.unfollow || []);

  async function importZip(file?: File) {
    if (!file) return;
    setBusy(true); setNotice('ZIP dosyası taranıyor…');
    try {
      const zip = await JSZip.loadAsync(file);
      const paths = Object.keys(zip.files);
      const find = (filename: string) => paths.find(p => p.toLowerCase().endsWith(filename.toLowerCase()));
      const readJson = async (path?: string) => path ? JSON.parse(await zip.file(path)!.async('string')) : null;
      const followingCandidates = paths.filter(p => (p.toLowerCase().split('/').pop() || '') === 'following.json');
      const followingPath = find('following.json');
      const pendingPath = find('pending_follow_requests.json');
      if (!followingPath) throw new Error('ZIP içinde following.json bulunamadı. Instagram dışa aktarmasında “Takipçiler ve takip edilenler” verisini seçtiğinden emin ol.');
      const followingRaw = await readJson(followingPath);
      const pendingRaw = pendingPath ? await readJson(pendingPath) : [];
      const followerPaths = paths.filter(p => {
        const name = p.toLowerCase().split('/').pop() || '';
        return name === 'followers.json' || /^followers_\d+\.json$/.test(name);
      });
      const followerRaw = (await Promise.all(followerPaths.map(readJson))).flatMap(x => Array.isArray(x) ? x : []);
      const rawFollowingEntries = Array.isArray(followingRaw?.relationships_following) ? followingRaw.relationships_following : [];
      const parsedFollowingEntries = rawFollowingEntries.map(personFromFollowing);
      const validFollowingEntries = parsedFollowingEntries.filter((x: Person | null): x is Person => Boolean(x?.username));
      const following = uniquePeople(parsedFollowingEntries);
      const followingTimestamps = following.map(x => x.timestamp).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
      const audit = { followingPath, followingFileCandidates: followingCandidates.length, rawFollowingCount: rawFollowingEntries.length, validFollowingCount: validFollowingEntries.length, duplicateFollowingCount: validFollowingEntries.length - following.length, invalidFollowingCount: rawFollowingEntries.length - validFollowingEntries.length, oldestFollowingAt: followingTimestamps.length ? Math.min(...followingTimestamps) : undefined, newestFollowingAt: followingTimestamps.length ? Math.max(...followingTimestamps) : undefined };
      const followers = uniquePeople(followerRaw.map(personFromFollower));
      const pendingItems = Array.isArray(pendingRaw) ? pendingRaw : (pendingRaw?.relationships_follow_requests_sent || pendingRaw?.relationships_follow_requests || []);
      const pending = uniquePeople(pendingItems.map(personFromPending));
      if (!following.length && !followers.length && !pending.length) throw new Error('Dosyalarda okunabilir takip verisi bulunamadı. JSON dışa aktarma biçimini kontrol et.');
      const importedDataset = { followers, following, pending, importedAt: new Date().toISOString(), fileName: file.name, audit };
      setData(importedDataset);
      try { await saveDatasetLocally(importedDataset); }
      catch { setNotice('Analiz tamamlandı ancak tarayıcı depolamasına kaydedilemedi. Sayfayı yenilersen ZIP dosyasını yeniden yüklemen gerekebilir.'); }
      setTab('overview'); setSearch('');
      setNotice(`Analiz tamamlandı: ${following.length.toLocaleString('tr-TR')} takip, ${followers.length.toLocaleString('tr-TR')} takipçi, ${pending.length.toLocaleString('tr-TR')} bekleyen istek.`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'ZIP dosyası okunamadı.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function mark(kind: 'pending' | 'unfollow' | 'inactive', username: string) {
    const next = { ...progress, [kind]: [...new Set([...(progress[kind] || []), username])] };
    setProgress(next); localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }
  function undo(kind: 'pending' | 'unfollow' | 'inactive', username: string) {
    const next = { ...progress, [kind]: (progress[kind] || []).filter(x => x !== username) };
    setProgress(next); localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }
  function saveCurrentFollowing() {
    const parsed = parseUsernames(currentFollowingText);
    if (!parsed.length) { setNotice('Karşılaştırma için güncel takip listesine kullanıcı adlarını ekle.'); return; }
    const parsedSet = new Set(parsed);
    const archiveOnlyCount = (data?.following || []).filter(x => !parsedSet.has(x.username)).length;
    setCurrentFollowing(parsed);
    localStorage.setItem(CURRENT_FOLLOWING_KEY, parsed.join('\n'));
    setTab('archive-extra');
    setNotice(`Güncel liste kaydedildi: ${parsed.length.toLocaleString('tr-TR')} hesap. Arşivde olup bu listede bulunmayan ${archiveOnlyCount.toLocaleString('tr-TR')} kayıt bulundu.`);
  }
  function clearProgress() {
    if (!confirm('Bu tarayıcıda kaydedilen işlem işaretleri silinsin mi?')) return;
    localStorage.removeItem(PROGRESS_KEY); setProgress({});
  }
  function exportCsv(rows: Person[], label: string) {
    const csv = ['username,profile_url,date', ...rows.map(x => x.username + ',https://www.instagram.com/' + x.username + '/,' + formatDate(x.timestamp))].join(String.fromCharCode(10));
    const blob = new Blob([String.fromCharCode(65279) + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `social-sweep-${label}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const currentRows = tab === 'pending' ? (data?.pending || []) : tab === 'not-following' ? notFollowing : tab === 'inactive' ? inactiveAccounts : tab === 'mutual' ? mutual : tab === 'followers-only' ? followersOnly : tab === 'archive-extra' ? archiveOnly : [];
  const filteredRows = currentRows.filter(x => x.username.includes(search.toLowerCase().replace(/^@/, '')));
  const title = tab === 'pending' ? 'Bekleyen takip istekleri' : tab === 'not-following' ? 'Seni takip etmeyenler' : tab === 'inactive' ? 'Erişilemeyen hesaplar' : tab === 'mutual' ? 'Karşılıklı takip' : tab === 'archive-extra' ? 'Arşivde fazladan görünenler' : 'Seni takip edenler';

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Activity size={21}/></div><div><b>social sweep</b><span>Instagram toolkit</span></div></div>
      <div className="side-label">ÇALIŞMA ALANI</div>
      <button className={`nav-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}><Activity size={18}/> Genel Bakış</button>
      <button className={`nav-item ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}><UserPlus size={18}/> Bekleyen istekler {data && <em>{data.pending.length}</em>}</button>
      <button className={`nav-item ${tab === 'not-following' ? 'active' : ''}`} onClick={() => setTab('not-following')}><UserMinus size={18}/> Geri takip etmeyenler {data && <em>{notFollowing.length}</em>}</button>
      <button className={`nav-item ${tab === 'inactive' ? 'active' : ''}`} onClick={() => setTab('inactive')}><CircleHelp size={18}/> Erişilemeyen hesaplar {data && <em>{inactiveAccounts.length}</em>}</button>
      <button className={`nav-item ${tab === 'archive-extra' ? 'active' : ''}`} onClick={() => setTab('archive-extra')}><FileArchive size={18}/> Arşivde fazladan görünenler {data && <em>{archiveOnly.length}</em>}</button>
      <button className={`nav-item ${tab === 'mutual' ? 'active' : ''}`} onClick={() => setTab('mutual')}><Heart size={18}/> Karşılıklı takip</button>
      <button className={`nav-item ${tab === 'followers-only' ? 'active' : ''}`} onClick={() => setTab('followers-only')}><Users size={18}/> Seni takip edenler</button>
      <div className="sidebar-bottom"><div className="privacy-mini"><LockKeyhole size={16}/><span>Verilerin cihazından çıkmaz.</span></div><a href="https://github.com/oguzhanipek/social-sweep" target="_blank" rel="noreferrer">GitHub projesi <ArrowUpRight size={14}/></a></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> Instagram analytics</div><div className="top-actions"><span className="local-pill"><span/> Yerel analiz</span><button className="icon-button" title="Veri gizliliği" onClick={() => setNotice('ZIP dosyan yalnızca tarayıcında işlenir. Herhangi bir sunucuya yüklenmez.')}><ShieldCheck size={18}/></button></div></header>
      <div className="page-wrap">
        <section className="hero"><div><div className="eyebrow"><Sparkles size={14}/> SOSYAL HESAP ANALİZİ</div><h1>Takip ilişkilerini<br/><span>kontrol altına al.</span></h1><p>Instagram verilerini içe aktar, takip durumunu analiz et ve hesabını kendi kontrolünle düzenle.</p><div className="hero-actions"><button className="primary-btn" onClick={() => fileRef.current?.click()} disabled={busy}><FileArchive size={17}/>{busy ? 'Dosya analiz ediliyor…' : data ? 'Yeni ZIP yükle' : 'Instagram ZIP dosyasını yükle'}</button>{data && <span className="imported"><CheckCircleIcon/> Veri yüklendi</span>}</div><input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={e => importZip(e.target.files?.[0])}/></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-center"><Instagram size={38}/></div><div className="float-card card-a"><UserPlus size={15}/><span>Takip istekleri</span></div><div className="float-card card-b"><Users size={15}/><span>Takip analizi</span></div><div className="float-dot"/></div></section>
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
        {!data ? <section className="empty-state"><div className="empty-icon"><FileArchive size={26}/></div><h2>{restoring ? 'Kayıtlı arşiv kontrol ediliyor…' : 'Henüz bir Instagram arşivi yüklenmedi'}</h2><p>{restoring ? 'Bu tarayıcıda daha önce içe aktardığın veriler aranıyor.' : 'Instagram arşivini seç. Analiz tamamen bu tarayıcıda yapılır; dosyan hiçbir yere gönderilmez.'}</p>{!restoring && <button className="secondary-btn" onClick={() => fileRef.current?.click()}>Dosya seç <ArrowUpRight size={16}/></button>}<div className="howto"><b>İpucu</b><span>Instagram Hesaplar Merkezi → Bilgilerin ve izinlerin → Bilgilerini indir veya aktar → Takipçiler ve takip edilenler → JSON</span></div></section> : <>
          {tab === 'overview' ? <>
            <div className="section-heading"><div><div className="eyebrow">HESAP ÖZETİ</div><h2>Genel Bakış</h2><p>Yüklenen arşivdeki takip ilişkilerinin özeti.</p></div><button className="text-btn" onClick={() => setNotice(`Son içe aktarma: ${new Date(data.importedAt).toLocaleString('tr-TR')} · ${data.fileName}`)}><RefreshCw size={15}/> İçe aktarma bilgisi</button></div>
            <div className="stats-grid"><Stat icon={<Users/>} label="Takipçi" value={data.followers.length}/><Stat icon={<UserPlus/>} label="Takip edilen" value={data.following.length}/><Stat icon={<UserMinus/>} label="Seni takip etmeyen" value={notFollowing.length} accent/><Stat icon={<Activity/>} label="Bekleyen istek" value={data.pending.length}/></div>
            <section className="panel audit-panel">
              <div className="panel-heading"><div><h3><ShieldCheck size={17}/> Arşiv veri denetimi</h3><p>ZIP içindeki takip kayıtlarının teknik kontrolü</p></div><span className="panel-tag">YEREL RAPOR</span></div>
              <div className="audit-grid">
                <div><small>Ham takip kaydı</small><b>{(data.audit?.rawFollowingCount ?? data.following.length).toLocaleString('tr-TR')}</b></div>
                <div><small>Geçerli kayıt</small><b>{(data.audit?.validFollowingCount ?? data.following.length).toLocaleString('tr-TR')}</b></div>
                <div><small>Tekrarlanan kayıt</small><b>{(data.audit?.duplicateFollowingCount ?? 0).toLocaleString('tr-TR')}</b></div>
                <div><small>Okunamayan kayıt</small><b>{(data.audit?.invalidFollowingCount ?? 0).toLocaleString('tr-TR')}</b></div>
              </div>
              <div className="audit-source"><span>Okunan dosya</span><code>{data.audit?.followingPath || 'Arşiv denetimi önceki sürümde yapılmamış'}</code><span>{data.audit?.followingFileCandidates ?? '—'} adet following.json bulundu</span><span>Takip kayıtlarının tarih aralığı: {data.audit?.oldestFollowingAt ? formatDate(data.audit.oldestFollowingAt) : '—'} – {data.audit?.newestFollowingAt ? formatDate(data.audit.newestFollowingAt) : '—'}</span></div>
              <div className="audit-compare">
                <label htmlFor="live-following-count">Instagram profilindeki güncel “takip” sayısı</label>
                <input id="live-following-count" inputMode="numeric" type="number" min="0" value={liveFollowingCount} onChange={e => setLiveFollowingCount(e.target.value)} placeholder="Örn. 285"/>
                {liveFollowingCount !== '' && Number.isFinite(Number(liveFollowingCount)) && Number(liveFollowingCount) >= 0 && <div className="audit-difference"><span>Arşiv ile fark</span><b>{(data.following.length - Number(liveFollowingCount)).toLocaleString('tr-TR')} hesap</b></div>}
              </div>
              <p className="audit-footnote">Bu karşılaştırma yalnızca sayıları gösterir. Farkın nedeni hakkında tek başına kesin sonuç vermez; arşiv tarihi, dosya kapsamı ve Instagram'daki güncel durum ayrıca incelenmelidir.</p>
              <div className="archive-compare-input" style={{marginTop:18,paddingTop:16,borderTop:'1px solid var(--border, #302a42)'}}>
                <label htmlFor="current-following-list" style={{display:'block',marginBottom:8,fontSize:13,color:'var(--muted, #a99bc9)'}}>Instagram'daki güncel takip edilen hesapların kullanıcı adları</label>
                <textarea id="current-following-list" value={currentFollowingText} onChange={e => setCurrentFollowingText(e.target.value)} placeholder={'Her satıra bir kullanıcı adı yapıştır. Örnek:\noguzhan_ornek\nhttps://www.instagram.com/ornek/\n@baska_hesap'} rows={5} style={{width:'100%',resize:'vertical',background:'var(--surface, #100e18)',color:'inherit',border:'1px solid var(--border, #39314d)',borderRadius:10,padding:12,font:'inherit',fontSize:13,boxSizing:'border-box'}} />
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:10}}><button className="primary-btn" onClick={saveCurrentFollowing}><Check size={16}/> Listeyi kaydet ve karşılaştır</button><span className="audit-footnote">{currentFollowing.length ? `${currentFollowing.length.toLocaleString('tr-TR')} kullanıcı adı kayıtlı · ${archiveOnly.length.toLocaleString('tr-TR')} arşiv fazlası` : 'Kullanıcı adları yalnızca bu tarayıcıda saklanır.'}</span></div>
              </div>
            </section>
            <div className="content-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Takip dağılımı</h3><p>Takip ettiğin hesapların durumu</p></div><span className="panel-tag">ÖZET</span></div><div className="distribution"><div className="donut" style={{'--mutual': `${data.following.length ? mutual.length / data.following.length * 100 : 0}%`} as CSSProperties}><div><b>{data.following.length ? Math.round(mutual.length / data.following.length * 100) : 0}%</b><span>karşılıklı</span></div></div><div className="legend"><Legend color="purple" label="Karşılıklı takip" value={mutual.length}/><Legend color="orange" label="Geri takip etmeyen" value={notFollowing.length}/></div></div></section>
              <section className="panel quick-panel"><div className="panel-heading"><div><h3>Hızlı işlemler</h3><p>Analiz listelerine geç</p></div><Sparkles size={18} className="muted-icon"/></div><QuickAction icon={<UserPlus/>} title="Bekleyen istekler" detail={`${data.pending.length.toLocaleString('tr-TR')} hesap`} onClick={() => setTab('pending')}/><QuickAction icon={<UserMinus/>} title="Geri takip etmeyenler" detail={`${notFollowing.length.toLocaleString('tr-TR')} hesap`} onClick={() => setTab('not-following')}/><QuickAction icon={<Heart/>} title="Karşılıklı takip" detail={`${mutual.length.toLocaleString('tr-TR')} hesap`} onClick={() => setTab('mutual')}/></section></div>
            <div className="privacy-banner"><ShieldCheck size={20}/><div><b>Gizlilik öncelikli tasarım</b><span>Arşivin tarayıcında okunur. Instagram şifreni istemeyiz ve hesabına senin adına giriş yapmayız.</span></div></div>
          </> : <>
            <div className="section-heading"><div><div className="eyebrow">TAKİP YÖNETİMİ</div><h2>{title}</h2><p>{tab === 'pending' ? 'Gönderdiğin ve henüz yanıtlanmamış takip istekleri.' : tab === 'not-following' ? 'Seni takip etmeyen ve erişilebilir olduğunu kontrol ettiğin hesaplar.' : tab === 'inactive' ? 'Profilini açtığında erişilemediğini gördüğün hesaplar. Bu hesaplar takip etmeyenler sayısından çıkarılır.' : tab === 'archive-extra' ? 'Arşivde bulunan ancak yapıştırdığın güncel takip listesinde yer almayan hesaplar. Bu kayıtlar kesinlikle kapalı hesap anlamına gelmez.' : tab === 'mutual' ? 'Birbirinizi takip ettiğiniz hesaplar.' : 'Seni takip eden ancak senin takip etmediğin hesaplar.'}</p></div><button className="text-btn" onClick={() => exportCsv(currentRows, tab)}><ArrowDownToLine size={15}/> CSV dışa aktar</button></div>
            <section className="panel table-panel"><div className="table-toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kullanıcı adı ara…"/></div><div className="result-count"><span className="filter-symbol">⌕</span> {filteredRows.length.toLocaleString('tr-TR')} sonuç</div></div>
              <div className="table-head"><span>HESAP</span><span>ARŞİV TARİHİ</span><span>İŞLEM</span></div>
              <div className="table-body">{filteredRows.slice(0, 300).map(person => {
                const done = tab === 'pending' ? donePending.has(person.username) : tab === 'inactive' ? inactiveSet.has(person.username) : doneUnfollow.has(person.username);
                const kind = tab === 'pending' ? 'pending' : tab === 'inactive' ? 'inactive' : 'unfollow';
                return <div className={`table-row ${done ? 'is-done' : ''}`} key={person.username}>
                  <div className="account-cell"><div className="avatar">{person.username.slice(0,1).toUpperCase()}</div><div><b>@{person.username}</b><span>Instagram hesabı</span></div></div>
                  <span className="date-cell">{formatDate(person.timestamp)}</span>
                  <div className="row-actions">
                    <a className="open-profile" href={`https://www.instagram.com/${person.username}/`} target="_blank" rel="noreferrer">Profili aç <ArrowUpRight size={13}/></a>
                    {tab === 'pending' && <button className={`mark-btn ${done ? 'marked' : ''}`} onClick={() => done ? undo('pending', person.username) : mark('pending', person.username)}>{done ? <><Check size={14}/> Tamamlandı</> : 'Geri çekildi işaretle'}</button>}
                    {tab === 'not-following' && <><button className={`mark-btn ${doneUnfollow.has(person.username) ? 'marked' : ''}`} onClick={() => doneUnfollow.has(person.username) ? undo('unfollow', person.username) : mark('unfollow', person.username)}>{doneUnfollow.has(person.username) ? 'Takipten çıkarıldı' : 'Takipten çıkarıldı işaretle'}</button><button className="mark-btn" onClick={() => mark('inactive', person.username)}>Erişilemiyor</button></>}
                    {tab === 'inactive' && <button className="mark-btn marked" onClick={() => undo('inactive', person.username)}>Aktif listeye geri al</button>}
                  </div>
                </div>;
              })}{filteredRows.length === 0 && <div className="no-results">Bu listede eşleşen hesap bulunamadı.</div>}{filteredRows.length > 300 && <div className="list-foot">İlk 300 hesap gösteriliyor. Daha dar arama yapabilir veya CSV olarak dışa aktarabilirsin.</div>}</div>
            </section>
            {(tab === 'pending' || tab === 'not-following' || tab === 'inactive' || tab === 'archive-extra') && <div className="action-note"><CircleHelp size={17}/><span><b>Manuel kontrol:</b> Profili Instagram'da aç. Erişilemiyorsa “Erişilemiyor” ile ayrı listeye al; bu işaret hesabın kesin kapalı olduğunu kanıtlamaz. Takipten çıkarma işlemini Instagram'da kendin yap.</span></div>}
          </>}
          <footer className="page-footer"><span>Social Sweep · Açık kaynaklı, topluluk odaklı proje</span><button onClick={clearProgress}>İşlem işaretlerini temizle</button></footer>
        </>}
      </div>
    </main>
  </div>;
}
function CheckCircleIcon(){return <span className="check-circle"><Check size={11}/></span>}
function Stat({icon,label,value,accent=false}:{icon:ReactNode;label:string;value:number;accent?:boolean}){return <div className="stat-card"><div className={`stat-icon ${accent?'orange':''}`}>{icon}</div><span>{label}</span><b>{value.toLocaleString('tr-TR')}</b><small>İçe aktarılan arşiv</small></div>}
function Legend({color,label,value}:{color:string;label:string;value:number}){return <div className="legend-row"><i className={color}/><span>{label}</span><b>{value.toLocaleString('tr-TR')}</b></div>}
function QuickAction({icon,title,detail,onClick}:{icon:ReactNode;title:string;detail:string;onClick:()=>void}){return <button className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span className="quick-copy"><b>{title}</b><small>{detail}</small></span><ArrowUpRight size={16}/></button>}
