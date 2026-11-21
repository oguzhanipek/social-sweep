(() => {
  const ID = "social-sweep-helper-panel";
  const old = document.getElementById(ID);
  if (old) old.remove();

  const norm = (value) => (value || "").replace(/\\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  const labels = [...document.querySelectorAll("button,[role='button']")]
    .filter(el => {
      const text = norm(el.innerText || el.getAttribute("aria-label"));
      return ["istek gönderildi", "request sent", "requested"].includes(text);
    });

  const panel = document.createElement("div");
  panel.id = ID;
  panel.style.cssText = "position:fixed;z-index:2147483647;right:18px;bottom:18px;width:310px;padding:16px;border-radius:12px;background:#171421;color:#fff;border:1px solid #8b6cff;box-shadow:0 12px 40px #0008;font:13px/1.5 Arial,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = "Social Sweep · Profil kontrolü";
  heading.style.cssText = "display:block;margin-bottom:8px;font-size:14px";
  const message = document.createElement("div");
  const close = document.createElement("button");
  close.textContent = "Kapat";
  close.style.cssText = "margin-top:12px;padding:7px 12px;border:0;border-radius:7px;background:#7354d6;color:#fff;cursor:pointer";
  close.onclick = () => panel.remove();
  panel.append(heading, message, close);
  document.body.append(panel);

  if (labels.length === 1) {
    const target = labels[0];
    target.style.outline = "3px solid #a78bfa";
    target.style.outlineOffset = "3px";
    message.textContent = "Bekleyen istek bulundu. Doğru hesabı kontrol et. İptal işlemini Instagram'da kendin başlatıp onayla; uzantı hiçbir düğmeye basmaz.";
  } else if (labels.length > 1) {
    message.textContent = "Birden fazla istek düğmesi bulundu. Güvenlik için otomatik seçim yapılmadı; profili ve düğmeyi kendin kontrol et.";
  } else {
    const follow = [...document.querySelectorAll("button,[role='button']")].some(el => {
      const text = norm(el.innerText || el.getAttribute("aria-label"));
      return ["takip et", "follow"].includes(text);
    });
    message.textContent = follow
      ? "Bu profilde bekleyen istek düğmesi bulunamadı. 'Takip Et' düğmesine dokunma; istek zaten iptal edilmiş, kabul edilmiş veya durum değişmiş olabilir."
      : "Bekleyen istek düğmesi algılanamadı. Instagram arayüzü yüklenmemiş olabilir veya düğme metni farklı olabilir. Hiçbir işlem yapılmadı.";
  }
})();