/**
 * AI Context Bridge - Content Script
 * Handles DOM interactions on AI chat platforms
 * Supports: ChatGPT, Claude, Gemini, Copilot, Poe, Perplexity
 */

// ===== SELECTORS FOR DIFFERENT AI PLATFORMS =====
const PLATFORM_SELECTORS = {
  // ChatGPT / OpenAI
  chatgpt: {
    input: '#prompt-textarea, textarea[data-id="root"], div[contenteditable="true"][id="prompt-textarea"]',
    conversation: '[data-message-author-role]',
    container: 'main'
  },
  // Claude / Anthropic
  claude: {
    input: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
    conversation: '[data-testid="message-content"], .font-claude-message',
    container: 'main'
  },
  // Google Gemini
  gemini: {
    input: 'rich-textarea div[contenteditable="true"], .ql-editor',
    conversation: '.model-response-text, .response-content',
    container: 'main'
  },
  // Microsoft Copilot
  copilot: {
    input: 'textarea#userInput, cib-serp cib-action-bar textarea',
    conversation: '.ac-textBlock',
    container: 'main'
  },
  // Poe
  poe: {
    input: 'textarea[class*="ChatMessageInputView"]',
    conversation: '[class*="Message_messageRow"]',
    container: 'main'
  },
  // Perplexity
  perplexity: {
    input: 'textarea[placeholder*="Ask"]',
    conversation: '[class*="prose"]',
    container: 'main'
  }
};

// ===== DETECT CURRENT PLATFORM =====
function detectPlatform() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
    return 'chatgpt';
  }
  if (hostname.includes('claude.ai')) {
    return 'claude';
  }
  if (hostname.includes('gemini.google.com')) {
    return 'gemini';
  }
  if (hostname.includes('copilot.microsoft.com')) {
    return 'copilot';
  }
  if (hostname.includes('poe.com')) {
    return 'poe';
  }
  if (hostname.includes('perplexity.ai')) {
    return 'perplexity';
  }
  
  return null;
}

// ===== FIND INPUT ELEMENT =====
function findInputElement() {
  const platform = detectPlatform();
  
  // Try platform-specific selector first
  if (platform && PLATFORM_SELECTORS[platform]) {
    const input = document.querySelector(PLATFORM_SELECTORS[platform].input);
    if (input) return input;
  }
  
  // Fallback: try common selectors
  const fallbackSelectors = [
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Type"]',
    'div[contenteditable="true"]',
    'textarea[rows]'
  ];
  
  for (const selector of fallbackSelectors) {
    const element = document.querySelector(selector);
    if (element && isVisible(element)) {
      return element;
    }
  }
  
  return null;
}

// ===== GET CONVERSATION TEXT =====
function getConversationText() {
  const platform = detectPlatform();
  let messages = [];
  
  // Try platform-specific selector
  if (platform && PLATFORM_SELECTORS[platform]) {
    const elements = document.querySelectorAll(PLATFORM_SELECTORS[platform].conversation);
    elements.forEach(el => {
      const text = el.innerText || el.textContent;
      if (text && text.trim() && text.trim().length > 20) {
        messages.push(text.trim());
      }
    });
  }
  
  // If no messages found, try generic approach
  if (messages.length === 0) {
    // Look for common message container patterns
    const containers = document.querySelectorAll('[class*="message"], [class*="Message"], [data-message], [role="article"]');
    containers.forEach(el => {
      const text = el.innerText || el.textContent;
      if (text && text.trim() && text.length > 30) {
        messages.push(text.trim());
      }
    });
  }
  
  // Filter out UI/boilerplate text that's not actual conversation
  const filteredMessages = messages.filter(msg => {
    const lower = msg.toLowerCase();
    // Skip common UI elements and placeholder text
    const uiPatterns = [
      'how can i help',
      'start a new chat',
      'what can i help',
      'enter a prompt',
      'type a message',
      'upload a file',
      'attach files',
      'new conversation'
    ];
    return !uiPatterns.some(pattern => lower.includes(pattern) && msg.length < 100);
  });
  
  // Remove duplicates and join
  const uniqueMessages = [...new Set(filteredMessages)];
  return uniqueMessages.join('\n\n---\n\n');
}

// ===== INJECT TEXT INTO INPUT =====
function injectText(text) {
  const input = findInputElement();
  
  if (!input) {
    console.log('AI Context Bridge: Could not find input element');
    return false;
  }
  
  try {
    // Handle contenteditable divs (Claude, ChatGPT newer versions)
    if (input.getAttribute('contenteditable') === 'true') {
      // Focus the element
      input.focus();
      
      // Clear existing content and insert new text
      // Use execCommand for better compatibility with React
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      
      // Dispatch input event
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
      
      return true;
    }
    
    // Handle textarea elements
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.focus();
      
      // Set the value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, text);
      } else {
        input.value = text;
      }
      
      // Dispatch events for React
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Auto-resize if needed
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
      
      return true;
    }
    
    console.log('AI Context Bridge: Unsupported input type');
    return false;
    
  } catch (error) {
    console.error('AI Context Bridge: Injection error:', error);
    return false;
  }
}

// ===== GET SELECTED TEXT =====
function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

// ===== UTILITY: CHECK IF ELEMENT IS VISIBLE =====
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('AI Context Bridge: Received message:', message.type);
  
  switch (message.type) {
    case 'INJECT_CONTEXT':
      const success = injectText(message.prompt);
      sendResponse({ success });
      break;
      
    case 'GET_SELECTION':
      const selectedText = getSelectedText();
      sendResponse({ text: selectedText });
      break;
      
    case 'GET_CONVERSATION':
      const conversationText = getConversationText();
      sendResponse({ text: conversationText });
      break;
      
    case 'PING':
      sendResponse({ success: true, platform: detectPlatform() });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  // Return true to indicate async response
  return true;
});

// ===== INITIALIZATION =====
console.log('AI Context Bridge: Content script loaded on', window.location.hostname);
console.log('AI Context Bridge: Detected platform:', detectPlatform());
