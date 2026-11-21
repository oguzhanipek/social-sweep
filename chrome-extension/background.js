chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SOCIAL_SWEEP_FORWARD") return;
  (async () => {
    const tabs = await chrome.tabs.query({ url: ["http://localhost:5173/*", "http://127.0.0.1:5173/*"] });
    if (!tabs.length) throw new Error("Social Sweep localhost:5173 sekmesi açık değil.");
    const target = tabs.find(tab => tab.active) || tabs[0];
    await chrome.scripting.executeScript({
      target: { tabId: target.id },
      func: (payload) => window.postMessage(payload, window.location.origin),
      args: [message.payload]
    });
    sendResponse({ ok: true });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("https://www.instagram.com/")) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (error) {
    console.error("Social Sweep helper could not inspect this tab:", error);
  }
});