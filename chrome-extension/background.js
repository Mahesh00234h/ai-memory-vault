// AI Context Bridge - Background Service Worker
console.log('AI Context Bridge: Background started');

const AI_PLATFORMS = { 'chat.openai.com': 'ChatGPT', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude', 'gemini.google.com': 'Gemini', 'copilot.microsoft.com': 'Copilot', 'poe.com': 'Poe', 'perplexity.ai': 'Perplexity' };
let lastCaptureTime = {};
const CAPTURE_COOLDOWN = 120000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['capturedContexts', 'settings'], r => {
    if (!r.capturedContexts) chrome.storage.local.set({ capturedContexts: [] });
    if (!r.settings) chrome.storage.local.set({ settings: { autoCapture: true } });
  });
  chrome.contextMenus.create({ id: 'capture-selection', title: 'Capture to AI Context Bridge', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-selection' && info.selectionText) {
    saveCapturedContext({ id: 'ctx_' + Date.now().toString(36), platform: detectPlatform(tab.url) || 'Manual', url: tab.url, title: 'Selected: ' + info.selectionText.substring(0, 50), rawContent: info.selectionText, summary: info.selectionText.substring(0, 200), keyPoints: [], techStack: [], decisions: [], openQuestions: [], messageCount: 1, capturedAt: new Date().toISOString(), type: 'selection' });
  }
});

function detectPlatform(url) {
  if (!url) return null;
  try { const h = new URL(url).hostname; for (const [d, n] of Object.entries(AI_PLATFORMS)) if (h.includes(d)) return n; } catch (e) {}
  return null;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'GET_CAPTURED_CONTEXTS') getCapturedContexts().then(sendResponse);
  else if (req.type === 'DELETE_CAPTURED_CONTEXT') deleteCapturedContext(req.contextId).then(sendResponse);
  else if (req.type === 'CAPTURE_CURRENT') captureCurrentTab().then(sendResponse);
  else if (req.type === 'CONTENT_UPDATED') handleContentUpdate(sender.tab, req.platform).then(sendResponse);
  return true;
});

async function handleContentUpdate(tab, platform) {
  if (!tab?.id || !tab?.url) return { success: false };
  const urlKey = tab.url.split('?')[0];
  if (Date.now() - (lastCaptureTime[urlKey] || 0) < CAPTURE_COOLDOWN) return { success: false, reason: 'cooldown' };
  await performCapture(tab.id, tab.url, platform, true);
  lastCaptureTime[urlKey] = Date.now();
  return { success: true };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const platform = detectPlatform(tab.url);
  if (!platform) return;
  const settings = await chrome.storage.local.get('settings');
  if (!settings.settings?.autoCapture) return;
  await new Promise(r => setTimeout(r, 3000));
  await performCapture(tabId, tab.url, platform, false);
});

async function performCapture(tabId, url, platform, isUpdate) {
  const urlKey = url.split('?')[0];
  if (!isUpdate && Date.now() - (lastCaptureTime[urlKey] || 0) < CAPTURE_COOLDOWN) return;
  
  let conv;
  try { conv = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONVERSATION' }); } catch { return; }
  if (!conv?.text || conv.text.trim().length < 50) return;
  
  const text = conv.text.trim();
  if (text.split('\n').filter(l => l.trim().length > 10).length < 2) return;
  
  const currentTab = await chrome.tabs.get(tabId);
  const detailed = generateDetailedContext(conv.text, platform, currentTab?.title || '');
  const existing = await findExistingContext(url);
  
  if (existing && isUpdate) {
    Object.assign(existing, { rawContent: conv.text, summary: detailed.summary, keyPoints: detailed.keyPoints, techStack: detailed.techStack, decisions: detailed.decisions, openQuestions: detailed.openQuestions, messageCount: detailed.messageCount, lastUpdated: new Date().toISOString(), title: detailed.topic || cleanTitle(currentTab?.title, platform) || existing.title });
    await updateExistingContext(existing);
  } else if (!existing) {
    await saveCapturedContext({ id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5), platform, url: currentTab?.url || url, title: detailed.topic || cleanTitle(currentTab?.title, platform) || 'Untitled Chat', rawContent: conv.text, ...detailed, capturedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), type: 'auto' });
  }
  lastCaptureTime[urlKey] = Date.now();
  updateBadge();
}

async function findExistingContext(url) {
  const r = await chrome.storage.local.get('capturedContexts');
  return (r.capturedContexts || []).find(c => c.url.split('?')[0] === url.split('?')[0]);
}

async function updateExistingContext(ctx) {
  const r = await chrome.storage.local.get('capturedContexts');
  const contexts = r.capturedContexts || [];
  const i = contexts.findIndex(c => c.id === ctx.id);
  if (i !== -1) { contexts[i] = ctx; await chrome.storage.local.set({ capturedContexts: contexts }); }
}

async function saveCapturedContext(ctx) {
  const r = await chrome.storage.local.get('capturedContexts');
  const contexts = r.capturedContexts || [];
  contexts.unshift(ctx);
  if (contexts.length > 50) contexts.pop();
  await chrome.storage.local.set({ capturedContexts: contexts });
  updateBadge();
}

async function getCapturedContexts() { return (await chrome.storage.local.get('capturedContexts')).capturedContexts || []; }
async function deleteCapturedContext(id) { const r = await chrome.storage.local.get('capturedContexts'); await chrome.storage.local.set({ capturedContexts: (r.capturedContexts || []).filter(c => c.id !== id) }); updateBadge(); return { success: true }; }
async function captureCurrentTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab) await performCapture(tab.id, tab.url, detectPlatform(tab.url), false); return { success: true }; }
function updateBadge() { chrome.storage.local.get('capturedContexts', r => { const c = (r.capturedContexts || []).length; chrome.action.setBadgeText({ text: c > 0 ? c.toString() : '' }); chrome.action.setBadgeBackgroundColor({ color: '#6366F1' }); }); }

function cleanTitle(title, platform) {
  if (!title) return null;
  const generic = ['new chat', 'untitled', 'chat', 'home', 'chatgpt', 'claude', 'gemini'];
  if (generic.some(g => title.toLowerCase() === g)) return null;
  let cleaned = title.replace(/^(claude|chatgpt|gemini|copilot|poe|perplexity)\s*[-–—|:]\s*/i, '').replace(/\s*[-–—|:]\s*(claude|chatgpt|gemini|copilot|poe|perplexity)$/i, '').trim();
  return cleaned.length > 3 ? cleaned : null;
}

function generateDetailedContext(text, platform, pageTitle) {
  const lines = text.split('\n').filter(l => l.trim());
  const messageCount = text.split('---').length;
  let topic = cleanTitle(pageTitle, platform);
  if (!topic) { const first = lines.find(l => l.length > 10 && l.length < 100); topic = first ? first.substring(0, 60) : 'Untitled Chat'; }
  
  const keyPoints = [], decisions = [], openQuestions = [];
  const techKeywords = ['React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'PostgreSQL', 'MongoDB', 'Supabase', 'Firebase', 'AWS', 'Tailwind', 'GraphQL', 'REST', 'Docker'];
  const techStack = [...new Set(text.split(/[\s,.\-()[\]{}:;'"\/\\]+/).filter(w => techKeywords.some(t => w.toLowerCase() === t.toLowerCase())))].slice(0, 10);
  
  for (const line of lines) {
    if (keyPoints.length < 5 && ['key', 'important', 'must', 'should'].some(k => line.toLowerCase().includes(k)) && line.length > 20 && line.length < 200) keyPoints.push(line.substring(0, 150));
    if (decisions.length < 5 && ['decided', 'will use', 'going with', 'chose'].some(k => line.toLowerCase().includes(k)) && line.length > 15) decisions.push(line.substring(0, 150));
    if (openQuestions.length < 5 && line.trim().endsWith('?') && line.length > 10) openQuestions.push(line.substring(0, 150));
  }
  
  const summary = lines.filter(l => l.length > 20).slice(0, 3).join(' ').substring(0, 300) || 'Conversation about ' + topic;
  return { topic, summary, keyPoints, techStack, decisions, openQuestions, messageCount };
}

updateBadge();
