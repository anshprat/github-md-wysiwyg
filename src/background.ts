/**
 * Injects the (large) WYSIWYG editor bundle into a github.com tab only when
 * the user opens rich-text mode, so ordinary GitHub pages stay light.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'gmw:load-editor' || sender.tab?.id == null) return
  const target = { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] }
  Promise.all([
    chrome.scripting.insertCSS({ target, files: ['dist/editor.css'] }),
    chrome.scripting.executeScript({ target, files: ['dist/editor.js'] }),
  ]).then(
    () => sendResponse({ ok: true }),
    (err) => sendResponse({ ok: false, error: String(err?.message ?? err) }),
  )
  return true
})
