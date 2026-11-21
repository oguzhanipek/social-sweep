import { useEffect, useMemo, useRef, useState } from 'react';

type Person = { username: string; timestamp?: number; href?: string };
type Props = { rows: Person[]; completed: string[]; skipped: string[]; onComplete: (username: string) => void; onSkip: (username: string) => void; onRestoreSkipped: () => void };
const TIMER_KEY = 'social-sweep-pending-next-at-v1';
const BATCH_KEY = 'social-sweep-pending-batch-count-v1';
const SESSION_KEY = 'social-sweep-pending-session-v1';
const BATCH_SIZE = 100;
const BETWEEN_ITEMS_SECONDS = 10;
const BATCH_BREAK_SECONDS = 5 * 60;

export default function PendingQueue({ rows, completed, skipped, onComplete, onSkip, onRestoreSkipped }: Props) {
  const [nextAt, setNextAt] = useState<number>(() => {
    const saved = Number(localStorage.getItem(TIMER_KEY) || 0);
    return Number.isFinite(saved) ? saved : 0;
  });
  const [now, setNow] = useState(Date.now());
  const [sessionActive, setSessionActive] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(() => localStorage.getItem(SESSION_KEY) === '1');
  const instagramTabRef = useRef<Window | null>(null);
  const lastAutoOpenedRef = useRef<string>('');
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const skippedSet = useMemo(() => new Set(skipped), [skipped]);
  const remaining = useMemo(() => rows.filter(row => !completedSet.has(row.username) && !skippedSet.has(row.username)).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), [rows, completedSet, skippedSet]);
  const [batchCount, setBatchCount] = useState(() => Number(localStorage.getItem(BATCH_KEY) || 0) % BATCH_SIZE);
  const current = remaining[0];
  const secondsLeft = Math.max(0, Math.ceil((nextAt - now) / 1000));
  const ready = secondsLeft === 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!nextAt || secondsLeft > 0 || !current || !sessionActive) return;
    if (lastAutoOpenedRef.current === current.username) return;
    try {
      if (instagramTabRef.current && !instagramTabRef.current.closed) {
        instagramTabRef.current.location.href = `https://www.instagram.com/${current.username}/`;
        lastAutoOpenedRef.current = current.username;
      }
    } catch {
      // If the browser no longer permits navigation of the tab, the manual profile link remains available.
    }
    localStorage.removeItem(TIMER_KEY);
    setNextAt(0);
  }, [nextAt, secondsLeft, current, sessionActive]);

  function startSession() {
    if (!ready) return;
    setSessionActive(true);
    setResumeAvailable(false);
    localStorage.setItem(SESSION_KEY, '1');
    if (!current) return;
    const opened = window.open(`https://www.instagram.com/${current.username}/`, 'social-sweep-instagram');
    if (opened) {
      instagramTabRef.current = opened;
      lastAutoOpenedRef.current = current.username;
    }
  }

  function pauseSession() {
    setSessionActive(false);
    setResumeAvailable(true);
    localStorage.setItem(SESSION_KEY, '1');
  }

  function markWithdrawn() {
    if (!current || !ready || !sessionActive) return;
    onComplete(current.username);
    lastAutoOpenedRef.current = '';
    const nextBatchCount = (batchCount + 1) % BATCH_SIZE;
    setBatchCount(nextBatchCount);
    localStorage.setItem(BATCH_KEY, String(nextBatchCount));
    const waitSeconds = nextBatchCount === 0 ? BATCH_BREAK_SECONDS : BETWEEN_ITEMS_SECONDS;
    const next = Date.now() + waitSeconds * 1000;
    localStorage.setItem(TIMER_KEY, String(next));
    setNextAt(next);
  }

  function skipCurrent() {
    if (!current || !ready) return;
    onSkip(current.username);
    lastAutoOpenedRef.current = '';
    const next = Date.now() + BETWEEN_ITEMS_SECONDS * 1000;
    localStorage.setItem(TIMER_KEY, String(next));
    setNextAt(next);
  }

  function openCurrent() {
    if (!current || !ready || !sessionActive) return;
    const opened = window.open(`https://www.instagram.com/${current.username}/`, 'social-sweep-instagram');
    if (opened) {
      instagramTabRef.current = opened;
      lastAutoOpenedRef.current = current.username;
    }
  }

  return <section className="panel pending-queue">
    <div className="pending-queue-head">
      <div><span className="eyebrow">KONTROLLÜ İŞLEM SIRASI</span><h3>Bekleyen istekleri sırayla temizle</h3><p>En yeni gönderilmiş istekten eskiye doğru ilerler. Her iptali sen onaylarsın; hesaplar arasında 10 saniye bekler ve her 100 hesapta 5 dakika mola verir.</p></div>
      <span className="queue-count">{remaining.length.toLocaleString('tr-TR')} kaldı</span>
    </div>
    <div className="queue-progress"><span style={{width: `${rows.length ? (completed.length / rows.length) * 100 : 0}%`}} /></div>
    <div className="queue-meta"><span>{completed.length.toLocaleString('tr-TR')} / {rows.length.toLocaleString('tr-TR')} tamamlandı</span><span>{rows.length ? ((completed.length / rows.length) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : 0}%</span></div>
    {current ? <>
      <div className="queue-current"><div className="queue-avatar">{current.username.slice(0,1).toUpperCase()}</div><div><small>SIRADAKİ HESAP</small><b>@{current.username}</b><a href={`https://www.instagram.com/${current.username}/`} target="_blank" rel="noreferrer">Profil bağlantısını görüntüle</a></div></div>
      <div className="queue-controls">
        <div className="queue-batch-info"><small>BU GRUPTA İŞLENEN</small><b>{batchCount} / {BATCH_SIZE}</b><small>Her hesap: 10 saniye · 100 hesap sonrası: 5 dakika mola</small></div>
        {!sessionActive ? <button className="queue-primary" onClick={startSession} disabled={!ready}>{resumeAvailable ? 'Oturumu sürdür ve sıradaki profili aç' : 'Instagram sekmesini aç ve başlat'}</button> : <button className="queue-secondary" onClick={pauseSession}>Oturumu duraklat</button>}
        <button className="queue-open" onClick={openCurrent} disabled={!sessionActive || !ready}>Bu profili yeniden aç</button>
        <button className="queue-done" onClick={markWithdrawn} disabled={!sessionActive || !ready}>İsteği geri çektim</button>
        <button className="queue-open" onClick={skipCurrent} disabled={!ready}>Bu hesabı atla (istek yok / hata)</button>
      </div>
      {!ready && <div className="queue-wait">Sonraki profil aynı Instagram sekmesinde açılacak: <b>{Math.floor(secondsLeft / 60).toString().padStart(2,'0')}:{(secondsLeft % 60).toString().padStart(2,'0')}</b></div>}
      {!sessionActive && <div className="queue-hint">{resumeAvailable ? 'Önceki oturumun kaydı bulundu. Sürdür düğmesi mevcut sıradaki hesaptan devam eder. ' : ''}Başlat düğmesi Instagram'da tek bir sekme açar. İlgili profilde “Requested” düğmesine kendin basıp isteği iptal et; sonra buraya dönüp onayla.</div>}
      {sessionActive && ready && <div className="queue-hint">Instagram sekmesinde gösterilen isteği iptal ettiğinde buraya dönüp “İsteği geri çektim” düğmesine bas. Bekleme süresi sonunda aynı sekme sıradaki hesaba geçer. Her 100 onaylı işlemden sonra 5 dakika mola verilir.</div>}
    </> : <div className="queue-finished">Aktif sırada hesap kalmadı. 🎉</div>}
    <div className="queue-hint">Atlanan hesap: <b>{skipped.length.toLocaleString('tr-TR')}</b> · Bunlar geri çekildi olarak işaretlenmez. {skipped.length > 0 && <button className="queue-open" onClick={onRestoreSkipped}>Atlananları yeniden sıraya al</button>}</div>
    <div className="queue-safety">Instagram'daki iptal düğmesine otomatik basılmaz. Social Sweep yalnızca profil sekmesini sırayla yönlendirir ve senin onayladığın ilerlemeyi kaydeder. Instagram bir uyarı veya kısıtlama gösterirse işlemi durdur.</div>
  </section>;
}
