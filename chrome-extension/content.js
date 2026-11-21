(() => {
  const ID = "social-sweep-helper-panel";
  document.getElementById(ID)?.remove();

  const norm = value => (value || "").replace(/\\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  const path = location.pathname.toLowerCase();
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const dialog = dialogs.find(node => {
    const text = norm(node.innerText);
    return text.includes("takip ettikleri") || text.includes("following") || text.includes("takipçiler") || text.includes("followers");
  });
  const dialogText = dialog ? norm(dialog.innerText) : "";
  let listType = path.includes("/followers") ? "followers" : path.includes("/following") ? "following" : "";
  if (!listType && dialog) {
    if (dialogText.includes("takip ettikleri") || dialogText.includes("following")) listType = "following";
    else if (dialogText.includes("takipçiler") || dialogText.includes("followers")) listType = "followers";
  }

  const panel = document.createElement("div");
  panel.id = ID;
  panel.style.cssText = "position:fixed;z-index:2147483647;right:18px;bottom:18px;width:330px;padding:16px;border-radius:12px;background:#171421;color:#fff;border:1px solid #8b6cff;box-shadow:0 12px 40px #0008;font:13px/1.5 Arial,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = "Social Sweep · Instagram aktarımı";
  heading.style.cssText = "display:block;margin-bottom:8px;font-size:14px";
  const message = document.createElement("div");
  message.style.cssText = "margin-bottom:10px;color:#ddd";
  const collect = document.createElement("button");
  collect.textContent = "Görünen hesapları aktar";
  collect.style.cssText = "padding:9px 12px;border:0;border-radius:7px;background:#8b6cff;color:#fff;cursor:pointer;font-weight:bold";
  const close = document.createElement("button");
  close.textContent = "Kapat";
  close.style.cssText = "margin-left:8px;padding:9px 12px;border:1px solid #62547e;border-radius:7px;background:transparent;color:#fff;cursor:pointer";
  close.onclick = () => panel.remove();
  panel.append(heading, message, collect, close);
  document.body.append(panel);

  if (listType) {
    const root = dialog || document;
    message.textContent = (listType === "followers" ? "Takipçiler" : "Takip Ettikleri") + " listesi algılandı. Listeyi aşağı kaydırdıkça yeni görünen hesapları tekrar aktar.";
    collect.onclick = () => {
      const reserved = new Set(["accounts", "about", "explore", "direct", "p", "reel", "reels", "stories", "developer", "legal", "privacy", "terms", "emails", "challenge", "nametag"]);
      const usernames = [...new Set([...root.querySelectorAll('a[href]')].map(anchor => {
        try {
          const url = new URL(anchor.href, location.origin);
          if (url.hostname !== "www.instagram.com") return "";
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts.length !== 1) return "";
          const username = parts[0].replace(/^@/, "").toLowerCase();
          return /^[a-z0-9._]{1,30}$/.test(username) && !reserved.has(username) ? username : "";
        } catch { return ""; }
      }).filter(Boolean))];
      if (!usernames.length) { message.textContent = "Bu pencerede görünür hesap bağlantısı bulunamadı. Biraz kaydırıp tekrar dene."; return; }
      chrome.runtime.sendMessage({
        type: "SOCIAL_SWEEP_FORWARD",
        payload: { source: "social-sweep-extension", type: "LIVE_LIST", listType, usernames }
      }, response => {
        if (chrome.runtime.lastError) { message.textContent = "Aktarım hatası: " + chrome.runtime.lastError.message; return; }
        message.textContent = response?.ok
          ? usernames.length + " görünür hesap Social Sweep'e gönderildi. Listeyi aşağı kaydırıp yeniden aktarabilirsin."
          : (response?.error || "Social Sweep sekmesine ulaşılamadı.");
      });
    };
  } else {
    const labels = [...document.querySelectorAll("button,[role='button']")].filter(el =>
      ["istek gönderildi", "request sent", "requested"].includes(norm(el.innerText || el.getAttribute("aria-label")))
    );
    collect.style.display = "none";
    if (labels.length === 1) {
      labels[0].style.outline = "3px solid #a78bfa";
      labels[0].style.outlineOffset = "3px";
      message.textContent = "Bekleyen istek bulundu. İptal işlemini Instagram'da kendin başlatıp onayla; uzantı hiçbir düğmeye basmaz.";
    } else if (labels.length > 1) {
      message.textContent = "Birden fazla istek düğmesi bulundu. Güvenlik için otomatik seçim yapılmadı.";
    } else {
      message.textContent = "Takipçi veya takip edilenler listesi algılanamadı. Instagram'da ilgili liste penceresini açıp eklentiyi tekrar çalıştır.";
    }
  }
})();