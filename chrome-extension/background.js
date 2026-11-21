chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("https://www.instagram.com/")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (error) {
    console.error("Social Sweep helper could not inspect this tab:", error);
  }
});