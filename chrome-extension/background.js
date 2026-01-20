// AI Context Bridge - Background Service Worker
// Storage Strategy: Raw content → Cloud, Structured context → Local
// AI Analysis: Send captured chats to Gemini for intelligent context extraction
// Offline Mode: Queue syncs when offline, process when back online
// V2 Mode: optionally call ingest-memory edge function (feature flagged)
console.log('AI Context Bridge: Background started');

const AI_PLATFORMS = { 'chat.openai.com': 'ChatGPT', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude', 'gemini.google.com': 'Gemini', 'copilot.microsoft.com': 'Copilot', 'poe.com': 'Poe', 'perplexity.ai': 'Perplexity' };
const SUPABASE_URL = 'https://meqqbjhfmrpsiqsexcif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcXFiamhmbXJwc2lxc2V4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDkzNzUsImV4cCI6MjA4Mzk4NTM3NX0.pqoNxaO0CtEFpGSYOZ3JZk7S3B1EOEYuh9mymP1mDqI';

// WEB APP origin for cookie/session sharing (set to published URL once deployed)
const WEB_APP_ORIGINS = [
  'https://id-preview--92d58f64-a466-44ec-970c-cae01f8e0034.lovable.app'
];
const SUPABASE_STORAGE_KEY = 'sb-meqqbjhfmrpsiqsexcif-auth-token';

let lastCaptureTime = {};
const CAPTURE_COOLDOWN = 120000;
let isAnalyzing = {}; // Track which URLs are being analyzed
let cachedWebSession = null; // JWT access_token from web app

// ===== OFFLINE MODE & SYNC QUEUE =====
let isOnline = true;
let syncQueue = [];
let isSyncing = false;

// Check online status
async function checkOnlineStatus() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, { 
      method: 'HEAD', 
      headers: { 'apikey': SUPABASE_ANON_KEY }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Initialize online status and listen for changes
(async () => {
  isOnline = await checkOnlineStatus();
  console.log('AI Context Bridge: Initial online status:', isOnline);
  
  // Load persisted queue
  const stored = await chrome.storage.local.get('syncQueue');
  syncQueue = stored.syncQueue || [];
  if (syncQueue.length > 0 && isOnline) {
    processSyncQueue();
  }
})();

// Periodically check online status (every 30 seconds)
setInterval(async () => {
  const wasOnline = isOnline;
  isOnline = await checkOnlineStatus();
  
  if (!wasOnline && isOnline) {
    console.log('AI Context Bridge: Back online, processing queue');
    processSyncQueue();
  }
}, 30000);

// Add item to sync queue
async function addToSyncQueue(item) {
  // Deduplicate by contextId for updates
  if (item.type === 'update' && item.cloudId) {
    syncQueue = syncQueue.filter(q => !(q.type === 'update' && q.cloudId === item.cloudId));
  }
  // Deduplicate by localId for creates
  if (item.type === 'create' && item.localId) {
    syncQueue = syncQueue.filter(q => !(q.type === 'create' && q.localId === item.localId));
  }
  
  syncQueue.push({ ...item, queuedAt: Date.now() });
  await chrome.storage.local.set({ syncQueue });
  
  if (isOnline && !isSyncing) {
    processSyncQueue();
  }
}

// Sync progress tracking
let syncProgress = { total: 0, completed: 0, current: null };

function broadcastSyncProgress() {
  chrome.runtime.sendMessage({ 
    type: 'SYNC_PROGRESS_UPDATE', 
    progress: { ...syncProgress, queueLength: syncQueue.length }
  }).catch(() => {}); // Ignore if popup is closed
}

// Process sync queue with progress updates
async function processSyncQueue() {
  if (isSyncing || syncQueue.length === 0) return;
  
  isSyncing = true;
  syncProgress = { total: syncQueue.length, completed: 0, current: null };
  broadcastSyncProgress();
  
  console.log('AI Context Bridge: Processing sync queue', syncQueue.length, 'items');
  
  const storage = await chrome.storage.local.get(['userId']);
  if (!storage.userId || storage.userId.startsWith('local_')) {
    isSyncing = false;
    syncProgress = { total: 0, completed: 0, current: null };
    broadcastSyncProgress();
    return;
  }
  
  const failedItems = [];
  const queueCopy = [...syncQueue];
  
  for (let i = 0; i < queueCopy.length; i++) {
    const item = queueCopy[i];
    syncProgress.current = item.data?.title || `Item ${i + 1}`;
    syncProgress.completed = i;
    broadcastSyncProgress();
    
    try {
      if (item.type === 'create') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(item.data)
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result[0]?.id && item.localId) {
            // Update local context with cloudId
            const r = await chrome.storage.local.get('capturedContexts');
            const contexts = r.capturedContexts || [];
            const idx = contexts.findIndex(c => c.id === item.localId);
            if (idx !== -1) {
              contexts[idx].cloudId = result[0].id;
              await chrome.storage.local.set({ capturedContexts: contexts });
            }
          }
        } else {
          throw new Error('Create failed');
        }
      } else if (item.type === 'update') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${item.cloudId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(item.data)
        });
        
        if (!response.ok) throw new Error('Update failed');
      }
    } catch (e) {
      console.error('Sync queue item failed:', e);
      failedItems.push(item);
    }
    
    // Small delay between items to not overwhelm
    await new Promise(r => setTimeout(r, 100));
  }
  
  syncQueue = failedItems;
  await chrome.storage.local.set({ syncQueue });
  isSyncing = false;
  
  syncProgress = { total: queueCopy.length, completed: queueCopy.length, current: null };
  broadcastSyncProgress();
  
  // Clear progress after a moment
  setTimeout(() => {
    syncProgress = { total: 0, completed: 0, current: null };
    broadcastSyncProgress();
  }, 2000);
  
  console.log('AI Context Bridge: Queue processed, remaining:', syncQueue.length);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['capturedContexts', 'settings'], r => {
    if (!r.capturedContexts) chrome.storage.local.set({ capturedContexts: [] });
    // Defaults: autoCapture on, useV2Ingest off (behind feature flag)
    if (!r.settings) chrome.storage.local.set({ settings: { autoCapture: true, useV2Ingest: false } });
    else if (r.settings && r.settings.useV2Ingest === undefined) {
      chrome.storage.local.set({ settings: { ...r.settings, useV2Ingest: false } });
    }
  });
  chrome.contextMenus.create({ id: 'capture-selection', title: 'Capture to AI Context Bridge', contexts: ['selection'] });
});

// ===== V2 SESSION HELPER =====
// Try to read the Supabase auth session from the web app cookie/localStorage via an injected script
async function fetchWebSession() {
  for (const origin of WEB_APP_ORIGINS) {
    try {
      // Attempt to access localStorage of the web app origin via cookies API (requires host_permissions)
      const cookies = await chrome.cookies.getAll({ domain: new URL(origin).hostname });
      const sbCookie = cookies.find(c => c.name === SUPABASE_STORAGE_KEY);
      if (sbCookie?.value) {
        try {
          const decoded = decodeURIComponent(sbCookie.value);
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) {
            cachedWebSession = parsed.access_token;
            return parsed.access_token;
          }
        } catch {}
      }
    } catch (e) {
      console.log('AI Context Bridge: cookie read failed', e);
    }
  }
  // fallback: try to read from local storage via runtime messaging to the web app tab
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (WEB_APP_ORIGINS.some(o => tab.url?.startsWith(o))) {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key) => localStorage.getItem(key),
          args: [SUPABASE_STORAGE_KEY]
        });
        if (result?.[0]?.result) {
          try {
            const parsed = JSON.parse(result[0].result);
            if (parsed.access_token) {
              cachedWebSession = parsed.access_token;
              return parsed.access_token;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return null;
}

// Queue for V2 ingest calls
let v2IngestQueue = [];

async function persistV2Queue() {
  await chrome.storage.local.set({ v2IngestQueue });
}

(async () => {
  const stored = await chrome.storage.local.get('v2IngestQueue');
  v2IngestQueue = stored.v2IngestQueue || [];
})();

async function addToV2Queue(item) {
  v2IngestQueue = v2IngestQueue.filter(q => q.threadKey !== item.threadKey);
  v2IngestQueue.push({ ...item, queuedAt: Date.now() });
  await persistV2Queue();
  processV2Queue();
}

async function processV2Queue() {
  const settings = (await chrome.storage.local.get('settings')).settings || {};
  if (!settings.useV2Ingest) return;
  const token = cachedWebSession || (await fetchWebSession());
  if (!token) {
    console.log('AI Context Bridge V2: no session, queue waiting');
    return;
  }
  const queueCopy = [...v2IngestQueue];
  const failed = [];
  for (const item of queueCopy) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ingest-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText: item.rawText,
          projectId: item.projectId || null,
          teamId: item.teamId || null,
          source: {
            platform: item.platform,
            url: item.url,
            threadKey: item.threadKey,
            pageTitle: item.pageTitle,
            capturedAt: item.capturedAt,
            messageCount: item.messageCount,
            contentHash: item.contentHash
          }
        })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error('AI Context Bridge V2: ingest failed', resp.status, txt);
        failed.push(item);
      } else {
        console.log('AI Context Bridge V2: ingested memory for', item.url);
      }
    } catch (e) {
      console.error('AI Context Bridge V2: ingest error', e);
      failed.push(item);
    }
  }
  v2IngestQueue = failed;
  await persistV2Queue();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-selection' && info.selectionText) {
    const ctx = { 
      id: 'ctx_' + Date.now().toString(36), 
      platform: detectPlatform(tab.url) || 'Manual', 
      url: tab.url, 
      title: 'Selected: ' + info.selectionText.substring(0, 50), 
      summary: info.selectionText.substring(0, 200), 
      keyPoints: [], 
      techStack: [], 
      decisions: [], 
      openQuestions: [], 
      messageCount: 1, 
      capturedAt: new Date().toISOString(), 
      type: 'selection' 
    };
    // Save context locally (no rawContent)
    saveLocalContext(ctx);
    // Save raw content to cloud
    saveRawToCloud(ctx, info.selectionText);
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
  else if (req.type === 'SYNC_ALL_CHATS') syncAllChatsFromPage(sender.tab).then(sendResponse);
  else if (req.type === 'GET_SYNC_STATUS') sendResponse({ isOnline, queueLength: syncQueue.length, syncProgress });
  else if (req.type === 'PROCESS_SYNC_QUEUE') processSyncQueue().then(() => sendResponse({ success: true }));
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
  
  // Skip if already analyzing this URL
  if (isAnalyzing[urlKey]) {
    console.log('AI Context Bridge: Already analyzing', urlKey);
    return;
  }
  
  if (!isUpdate && Date.now() - (lastCaptureTime[urlKey] || 0) < CAPTURE_COOLDOWN) return;
  
  let conv;
  try { conv = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONVERSATION' }); } catch { return; }
  if (!conv?.text || conv.text.trim().length < 50) return;
  
  const text = conv.text.trim();
  if (text.split('\n').filter(l => l.trim().length > 10).length < 2) return;
  
  const currentTab = await chrome.tabs.get(tabId);
  const existing = await findExistingContext(url);
  
  // Mark as analyzing
  isAnalyzing[urlKey] = true;
  
  try {
    // Use AI to analyze the context
    const aiAnalysis = await analyzeWithAI(text, platform, currentTab?.title || '');
    
    if (existing) {
      // UPDATE existing context - merge the new analysis
      console.log('AI Context Bridge: Updating existing context for', urlKey);
      Object.assign(existing, { 
        summary: aiAnalysis.summary || existing.summary, 
        keyPoints: aiAnalysis.keyPoints?.length ? aiAnalysis.keyPoints : existing.keyPoints, 
        techStack: aiAnalysis.techStack?.length ? aiAnalysis.techStack : existing.techStack, 
        decisions: aiAnalysis.decisions?.length ? aiAnalysis.decisions : existing.decisions, 
        openQuestions: aiAnalysis.openQuestions?.length ? aiAnalysis.openQuestions : existing.openQuestions, 
        messageCount: aiAnalysis.messageCount || existing.messageCount, 
        lastUpdated: new Date().toISOString(), 
        title: aiAnalysis.title || existing.title,
        topic: aiAnalysis.topic || existing.topic,
        // New enhanced fields
        projectOrigin: aiAnalysis.projectOrigin || existing.projectOrigin,
        coreInsights: aiAnalysis.coreInsights || existing.coreInsights,
        whatHasBeenBuilt: aiAnalysis.whatHasBeenBuilt?.length ? aiAnalysis.whatHasBeenBuilt : existing.whatHasBeenBuilt,
        strategicDirection: aiAnalysis.strategicDirection || existing.strategicDirection,
        currentStatus: aiAnalysis.currentStatus || existing.currentStatus,
        continuationPrompt: aiAnalysis.continuationPrompt || existing.continuationPrompt,
        importantContext: aiAnalysis.importantContext || existing.importantContext,
        aiAnalyzed: true
      });
      await updateExistingContext(existing);
      // Update raw content in cloud
      if (existing.cloudId) {
        updateRawInCloud(existing.cloudId, conv.text, existing);
      }
    } else {
      // CREATE new context
      console.log('AI Context Bridge: Creating new context for', urlKey);
      const ctx = { 
        id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5), 
        platform, 
        url: currentTab?.url || url, 
        title: aiAnalysis.title || cleanTitle(currentTab?.title, platform) || 'Untitled Chat', 
        topic: aiAnalysis.topic,
        summary: aiAnalysis.summary,
        keyPoints: aiAnalysis.keyPoints || [],
        techStack: aiAnalysis.techStack || [],
        decisions: aiAnalysis.decisions || [],
        openQuestions: aiAnalysis.openQuestions || [],
        messageCount: aiAnalysis.messageCount || text.split('---').length,
        // New enhanced fields
        projectOrigin: aiAnalysis.projectOrigin,
        coreInsights: aiAnalysis.coreInsights,
        whatHasBeenBuilt: aiAnalysis.whatHasBeenBuilt || [],
        strategicDirection: aiAnalysis.strategicDirection,
        currentStatus: aiAnalysis.currentStatus,
        continuationPrompt: aiAnalysis.continuationPrompt,
        importantContext: aiAnalysis.importantContext,
        capturedAt: new Date().toISOString(), 
        lastUpdated: new Date().toISOString(), 
        type: 'auto',
        aiAnalyzed: true
      };
      // Save context locally (without rawContent)
      await saveLocalContext(ctx);
      // Save raw content to cloud (V1)
      saveRawToCloud(ctx, conv.text);

      // V2 ingest (queued if enabled + session available)
      await maybeQueueV2Ingest({
        rawText: conv.text,
        url: ctx.url,
        platform: ctx.platform,
        pageTitle: currentTab?.title || '',
        threadKey: normalizeUrl(ctx.url),
        capturedAt: ctx.capturedAt,
        messageCount: ctx.messageCount
      });
    }
  } finally {
    isAnalyzing[urlKey] = false;
  }
  
  lastCaptureTime[urlKey] = Date.now();
  updateBadge();
}

// AI-powered context analysis using Gemini
async function analyzeWithAI(rawContent, platform, pageTitle) {
  try {
    console.log('AI Context Bridge: Analyzing with AI...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ rawContent, platform, pageTitle })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.analysis) {
        console.log('AI Context Bridge: AI analysis complete', result.analysis.title);
        return {
          ...result.analysis,
          messageCount: rawContent.split('---').length
        };
      }
    } else {
      console.warn('AI Context Bridge: AI analysis failed, status:', response.status);
    }
  } catch (e) {
    console.error('AI Context Bridge: AI analysis error:', e);
  }
  
  // Fallback to local analysis if AI fails
  console.log('AI Context Bridge: Falling back to local analysis');
  return generateDetailedContext(rawContent, platform, pageTitle);
}

// ===== V2 INGEST HELPER =====
async function maybeQueueV2Ingest(item) {
  const settings = (await chrome.storage.local.get('settings')).settings || {};
  if (!settings.useV2Ingest) return;
  await addToV2Queue(item);
}

// Find existing context by URL (normalize URL for comparison)
async function findExistingContext(url) {
  const r = await chrome.storage.local.get('capturedContexts');
  const normalizedUrl = normalizeUrl(url);
  return (r.capturedContexts || []).find(c => normalizeUrl(c.url) === normalizedUrl);
}

// Normalize URL for comparison (remove query params, trailing slashes, etc.)
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Keep the path but normalize it
    let path = u.pathname.replace(/\/+$/, ''); // Remove trailing slashes
    return `${u.hostname}${path}`;
  } catch {
    return url.split('?')[0].replace(/\/+$/, '');
  }
}

async function updateExistingContext(ctx) {
  const r = await chrome.storage.local.get('capturedContexts');
  const contexts = r.capturedContexts || [];
  const i = contexts.findIndex(c => c.id === ctx.id);
  if (i !== -1) { contexts[i] = ctx; await chrome.storage.local.set({ capturedContexts: contexts }); }
}

// Save context locally WITHOUT rawContent (structured data only)
async function saveLocalContext(ctx) {
  const r = await chrome.storage.local.get('capturedContexts');
  const contexts = r.capturedContexts || [];
  // Remove rawContent before saving locally
  const localCtx = { ...ctx };
  delete localCtx.rawContent;
  contexts.unshift(localCtx);
  if (contexts.length > 50) contexts.pop();
  await chrome.storage.local.set({ capturedContexts: contexts });
  updateBadge();
}

// Save raw content to cloud (with offline queue support)
async function saveRawToCloud(ctx, rawContent) {
  const storage = await chrome.storage.local.get(['userId']);
  if (!storage.userId || storage.userId.startsWith('local_')) return;
  
  const data = {
    user_id: storage.userId,
    url: ctx.url,
    title: ctx.title,
    topic: ctx.topic,
    summary: ctx.summary,
    key_points: ctx.keyPoints || [],
    tech_stack: ctx.techStack || [],
    decisions: ctx.decisions || [],
    open_questions: ctx.openQuestions || [],
    raw_content: rawContent,
    message_count: ctx.messageCount || 0,
    platform: ctx.platform
  };
  
  if (!isOnline) {
    // Queue for later
    await addToSyncQueue({ type: 'create', localId: ctx.id, data });
    console.log('AI Context Bridge: Queued create for offline sync');
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result[0]?.id) {
        const r = await chrome.storage.local.get('capturedContexts');
        const contexts = r.capturedContexts || [];
        const i = contexts.findIndex(c => c.id === ctx.id);
        if (i !== -1) {
          contexts[i].cloudId = result[0].id;
          await chrome.storage.local.set({ capturedContexts: contexts });
        }
      }
    } else {
      throw new Error('Save failed');
    }
  } catch (e) {
    console.error('Failed to save raw content to cloud, queuing:', e);
    await addToSyncQueue({ type: 'create', localId: ctx.id, data });
  }
}

// Update raw content in cloud (with offline queue support)
async function updateRawInCloud(cloudId, rawContent, contextData = {}) {
  const data = { 
    raw_content: rawContent, 
    updated_at: new Date().toISOString(),
    // Also update the analyzed data
    ...(contextData.summary && { summary: contextData.summary }),
    ...(contextData.title && { title: contextData.title }),
    ...(contextData.topic && { topic: contextData.topic }),
    ...(contextData.keyPoints?.length && { key_points: contextData.keyPoints }),
    ...(contextData.techStack?.length && { tech_stack: contextData.techStack }),
    ...(contextData.decisions?.length && { decisions: contextData.decisions }),
    ...(contextData.openQuestions?.length && { open_questions: contextData.openQuestions }),
    ...(contextData.messageCount && { message_count: contextData.messageCount })
  };
  
  if (!isOnline) {
    await addToSyncQueue({ type: 'update', cloudId, data });
    console.log('AI Context Bridge: Queued update for offline sync');
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${cloudId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Update failed');
    console.log('AI Context Bridge: Updated cloud context', cloudId);
  } catch (e) {
    console.error('Failed to update raw content in cloud, queuing:', e);
    await addToSyncQueue({ type: 'update', cloudId, data });
  }
}

// ===== SYNC ALL CHATS ON PAGE LOAD =====
// Prioritizes current chat, then syncs others in background
async function syncAllChatsFromPage(tab) {
  if (!tab?.id || !tab?.url) return { success: false };
  
  const platform = detectPlatform(tab.url);
  if (!platform) return { success: false, reason: 'not_ai_platform' };
  
  console.log('AI Context Bridge: Syncing current chat from', platform);
  
  // PRIORITY 1: Capture and display the current chat immediately
  await performCapture(tab.id, tab.url, platform, false);
  
  // Return immediately so UI can show the current chat
  // Schedule background sync for other chats
  setTimeout(() => backgroundSyncOtherChats(), 500);
  
  return { success: true, message: 'Current chat captured, syncing others in background' };
}

// Background sync for other chats (non-blocking)
async function backgroundSyncOtherChats() {
  const r = await chrome.storage.local.get(['capturedContexts', 'userId']);
  const contexts = r.capturedContexts || [];
  const userId = r.userId;
  
  if (!userId || userId.startsWith('local_')) {
    console.log('AI Context Bridge: No cloud user, skipping background sync');
    return;
  }
  
  // Find contexts that need to be synced (no cloudId)
  const unsyncedContexts = contexts.filter(c => !c.cloudId);
  
  if (unsyncedContexts.length === 0) {
    console.log('AI Context Bridge: All contexts already synced');
    return;
  }
  
  console.log('AI Context Bridge: Background syncing', unsyncedContexts.length, 'unsynced contexts');
  
  // Queue all unsynced contexts for cloud sync (they'll be processed one by one)
  for (const ctx of unsyncedContexts) {
    await addToSyncQueue({
      type: 'create',
      localId: ctx.id,
      data: {
        user_id: userId,
        url: ctx.url,
        title: ctx.title,
        topic: ctx.topic,
        summary: ctx.summary,
        key_points: ctx.keyPoints || [],
        tech_stack: ctx.techStack || [],
        decisions: ctx.decisions || [],
        open_questions: ctx.openQuestions || [],
        raw_content: null, // Raw content not available for old contexts
        message_count: ctx.messageCount || 0,
        platform: ctx.platform
      }
    });
  }
  
  // Process queue if online (will happen automatically with progress updates)
  if (isOnline) {
    processSyncQueue();
  }
}

// Legacy function for backward compatibility
async function saveCapturedContext(ctx) {
  await saveLocalContext(ctx);
}

async function getCapturedContexts() { return (await chrome.storage.local.get('capturedContexts')).capturedContexts || []; }

async function deleteCapturedContext(id) { 
  const r = await chrome.storage.local.get('capturedContexts'); 
  const ctx = (r.capturedContexts || []).find(c => c.id === id);
  
  // Delete from cloud if has cloudId
  if (ctx?.cloudId) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${ctx.cloudId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
    } catch (e) {
      console.error('Failed to delete from cloud:', e);
    }
  }
  
  await chrome.storage.local.set({ capturedContexts: (r.capturedContexts || []).filter(c => c.id !== id) }); 
  updateBadge(); 
  return { success: true }; 
}

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
