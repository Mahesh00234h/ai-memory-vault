// AI Context Bridge - Content Script
console.log('AI Context Bridge: Content script loaded');

const PLATFORMS = {
  'chat.openai.com': 'ChatGPT', 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude',
  'gemini.google.com': 'Gemini', 'copilot.microsoft.com': 'Copilot', 'poe.com': 'Poe', 'perplexity.ai': 'Perplexity'
};

const PLATFORM_SELECTORS = {
  ChatGPT: { conversation: '[data-message-author-role], .text-base, article[data-testid]' },
  Claude: { conversation: '[data-testid="conversation-turn"], .prose, div[class*="Message"]' },
  Gemini: { conversation: 'message-content, .response-container' },
  Copilot: { conversation: '.response-message, .user-message' },
  Poe: { conversation: '[class*="Message"], .ChatMessage' },
  Perplexity: { conversation: '[class*="prose"], .answer-text' }
};

// Check if extension context is still valid
function isExtensionValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function detectPlatform() {
  const hostname = window.location.hostname;
  for (const [domain, name] of Object.entries(PLATFORMS)) {
    if (hostname.includes(domain.replace('www.', ''))) return name;
  }
  return null;
}

// Safely send messages to background script
function safeSendMessage(message) {
  if (!isExtensionValid()) {
    console.log('AI Context Bridge: Extension context invalidated, skipping message');
    return Promise.resolve(null);
  }
  try {
    return chrome.runtime.sendMessage(message).catch(() => null);
  } catch (e) {
    console.log('AI Context Bridge: Failed to send message', e.message);
    return Promise.resolve(null);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isExtensionValid()) return;
  
  if (request.type === 'GET_CONVERSATION') {
    sendResponse({ text: extractConversation(detectPlatform()), platform: detectPlatform() });
  } else if (request.type === 'INJECT_CONTEXT') {
    sendResponse({ success: injectContext(request.context) });
  } else if (request.type === 'PING') {
    sendResponse({ pong: true });
  }
  return true;
});

function extractConversation(platform) {
  let messages = [];
  if (platform && PLATFORM_SELECTORS[platform]) {
    document.querySelectorAll(PLATFORM_SELECTORS[platform].conversation).forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 20) messages.push(text);
    });
  }
  if (!messages.length) {
    document.querySelectorAll('[class*="message"], [class*="Message"], [data-message]').forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 30) messages.push(text);
    });
  }
  const filtered = messages.filter(msg => {
    const lower = msg.toLowerCase();
    const uiPatterns = ['how can i help', 'start a new chat', 'enter a prompt', 'type a message'];
    return !uiPatterns.some(p => lower.includes(p) && msg.length < 100);
  });
  return [...new Set(filtered)].join('\n\n---\n\n');
}

function injectContext(context) {
  if (!isExtensionValid()) return false;
  
  try {
    const input = document.querySelector('textarea, div[contenteditable="true"], #prompt-textarea, .ProseMirror');
    if (input) {
      if (input.getAttribute('contenteditable') === 'true') input.innerHTML = context;
      else input.value = context;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return true;
    }
    navigator.clipboard.writeText(context).catch(() => {});
    return false;
  } catch (e) {
    console.log('AI Context Bridge: injectContext failed', e.message);
    return false;
  }
}

// Continuous capture with MutationObserver
let lastHash = '', debounceTimer = null, observer = null;
function hashContent(c) { let h = 0; for (let i = 0; i < c.length; i++) h = ((h << 5) - h) + c.charCodeAt(i) & 0xffffffff; return h.toString(); }

function notifyChange() {
  if (!isExtensionValid()) {
    // Stop observing if extension is invalidated
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    return;
  }
  
  const platform = detectPlatform();
  if (!platform) return;
  const content = extractConversation(platform);
  if (!content || content.length < 100) return;
  const hash = hashContent(content);
  if (hash !== lastHash) {
    lastHash = hash;
    safeSendMessage({ type: 'CONTENT_UPDATED', platform, contentLength: content.length });
  }
}

function setupObserver() {
  if (!detectPlatform() || !isExtensionValid()) return;
  observer = new MutationObserver(muts => {
    if (!isExtensionValid()) {
      observer.disconnect();
      observer = null;
      return;
    }
    if (muts.some(m => m.type === 'childList' && m.addedNodes.length)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(notifyChange, 5000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Trigger batch sync of all chats when landing on AI page
function triggerBatchSync() {
  if (!isExtensionValid()) return;
  
  const platform = detectPlatform();
  if (!platform) return;
  
  console.log('AI Context Bridge: Triggering batch sync on', platform);
  safeSendMessage({ type: 'SYNC_ALL_CHATS', platform });
}

setTimeout(setupObserver, 2000);
setTimeout(() => { 
  if (isExtensionValid()) { 
    const c = extractConversation(detectPlatform()); 
    if (c) lastHash = hashContent(c); 
  } 
}, 3000);

// Trigger batch sync when page fully loads
setTimeout(triggerBatchSync, 5000);
