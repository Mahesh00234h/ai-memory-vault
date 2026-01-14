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

function detectPlatform() {
  const hostname = window.location.hostname;
  for (const [domain, name] of Object.entries(PLATFORMS)) {
    if (hostname.includes(domain.replace('www.', ''))) return name;
  }
  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  const input = document.querySelector('textarea, div[contenteditable="true"], #prompt-textarea, .ProseMirror');
  if (input) {
    if (input.getAttribute('contenteditable') === 'true') input.innerHTML = context;
    else input.value = context;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    return true;
  }
  navigator.clipboard.writeText(context);
  return false;
}

// Continuous capture with MutationObserver
let lastHash = '', debounceTimer = null;
function hashContent(c) { let h = 0; for (let i = 0; i < c.length; i++) h = ((h << 5) - h) + c.charCodeAt(i) & 0xffffffff; return h.toString(); }

function notifyChange() {
  const platform = detectPlatform();
  if (!platform) return;
  const content = extractConversation(platform);
  if (!content || content.length < 100) return;
  const hash = hashContent(content);
  if (hash !== lastHash) {
    lastHash = hash;
    chrome.runtime.sendMessage({ type: 'CONTENT_UPDATED', platform, contentLength: content.length }).catch(() => {});
  }
}

function setupObserver() {
  if (!detectPlatform()) return;
  new MutationObserver(muts => {
    if (muts.some(m => m.type === 'childList' && m.addedNodes.length)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(notifyChange, 5000);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

setTimeout(setupObserver, 2000);
setTimeout(() => { const c = extractConversation(detectPlatform()); if (c) lastHash = hashContent(c); }, 3000);
