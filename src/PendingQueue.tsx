import { useEffect, useMemo, useState } from 'react';

type Person = { username: string; timestamp?: number; href?: string };
type Props = { rows: Person[]; completed: string[]; onComplete: (username: string) => void };
const TIMER_KEY = 'social-sweep-pending-next-at-v1';

export default function PendingQueue({ rows, completed, onComplete }: Props) {
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [nextAt, setNextAt] = useState<number>(() => {
    const saved = Number(localStorage.getItem(TIMER_KEY) || 0);
    return Number.isFinite(saved) ? saved : 0;
  });
  const [now, setNow] = useState(Date.now());
  const [sessionActive, setSessionActive] = useState(false);
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const remaining = useMemo(() => rows.filter(row => !completedSet.has(row.username)), [rows, completedSet]);
  const current = remaining[0];
  const secondsLeft = Math.max(0, Math.ceil((nextAt - now) / 1000));
  const ready = secondsLeft === 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (nextAt && nextAt <= Date.now()) {
      localStorage.removeItem(TIMER_KEY);
      setNextAt(0);
    }
  }, [nextAt, now]);

  function markWithdrawn() {
    if (!current || !ready || !sessionActive) return;
    onComplete(current.username);
    const next = Date.now() + intervalSeconds * 1000;
    localStorage.setItem(TIMER_KEY, String(next));
    setNextAt(next);
  }

  function openCurrent() {
    if (!current || !ready || !sessionActive) return;
    window.open(`https://www.instagram.com/${current.username}/`, '_blank', 'noopener,noreferrer');
  }

  return <section className="panel pending-queue">
    <div className="pending-queue-head">
      <div><span className="eyebrow">KONTROLLÜ İŞLEM SIRASI</span><h3>Bekleyen istekleri sırayla temizle</h3><p>Her isteği Instagram'da sen geri çekersin. Social Sweep yalnızca sırayı, bekleme süresini ve ilerlemeyi takip eder.</p></div>
      <span className="queue-count">{remaining.length.toLocaleString('tr-TR')} kaldı</span>
    </div>
    <div className="queue-progress"><span style={{width: `${rows.length ? (completed.length / rows.length) * 100 : 0}%`}} /></div>
    <div className="queue-meta"><span>{completed.length.toLocaleString('tr-TR')} / {rows.length.toLocaleString('tr-TR')} tamamlandı</span><span>{rows.length ? Math.round(completed.length / rows.length * 100) : 0}%</span></div>
    {current ? <>
      <div className="queue-current"><div className="queue-avatar">{current.username.slice(0,1).toUpperCase()}</div><div><small>SIRADAKİ HESAP</small><b>@{current.username}</b><a href={`https://www.instagram.com/${current.username}/`} target="_blank" rel="noreferrer">Profil bağlantısını görüntüle</a></div></div>
      <div className="queue-controls">
        <label>İşlemler arasındaki bekleme
          <select value={intervalSeconds} onChange={event => setIntervalSeconds(Number(event.target.value))} disabled={sessionActive && !ready}>
            <option value={15}>15 saniye</option><option value={30}>30 saniye</option><option value={60}>1 dakika</option><option value={120}>2 dakika</option><option value={300}>5 dakika</option>
          </select>
        </label>
        {!sessionActive ? <button className="queue-primary" onClick={() => setSessionActive(true)}>Sırayı başlat</button> : <button className="queue-secondary" onClick={() => setSessionActive(false)}>Oturumu duraklat</button>}
        <button className="queue-open" onClick={openCurrent} disabled={!sessionActive || !ready}>Instagram profilini aç</button>
        <button className="queue-done" onClick={markWithdrawn} disabled={!sessionActive || !ready}>İsteği geri çektim</button>
      </div>
      {!ready && <div className="queue-wait">Sonraki işlem için bekleniyor: <b>{Math.floor(secondsLeft / 60).toString().padStart(2,'0')}:{(secondsLeft % 60).toString().padStart(2,'0')}</b></div>}
      {!sessionActive && <div className="queue-hint">Başlat'a bastığında ilk profil açılabilir. Instagram'da isteği kendin geri çek; ardından “İsteği geri çektim” düğmesine bas. Sonraki hesap bekleme süresi bitince açılır.</div>}
      {sessionActive && ready && <div className="queue-hint">Sıradaki hesap hazır. Profili açıp isteği Instagram'da manuel olarak geri çek.</div>}
    </> : <div className="queue-finished">Listedeki tüm bekleyen istekler tamamlandı. 🎉</div>}
    <div className="queue-safety">Bu araç Instagram'a giriş yapmaz, istekleri otomatik iptal etmez ve Instagram arayüzünde otomatik tıklama yapmaz. İşlem onayı tamamen sende.</div>
  </section>;
}
