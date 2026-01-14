/**
 * AI Context Bridge - Background Service Worker
 * Handles extension lifecycle, cross-tab communication, and auto-capture
 */

// ===== INSTALLATION HANDLER =====
chrome.runtime.onInstalled.addListener((details) => {
  console.log('AI Context Bridge installed:', details.reason);
  
  // Initialize storage on first install
  if (details.reason === 'install') {
    chrome.storage.local.set({
      projects: [],
      activeProjectId: null,
      capturedContexts: [],
      settings: {
        autoCapture: true,
        showNotifications: true
      }
    });
    
    console.log('AI Context Bridge: Storage initialized');
  }
});

// ===== CONTEXT MENU SETUP =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'captureSelection',
      title: 'Capture to AI Context Bridge',
      contexts: ['selection']
    });
  });
});

// ===== CONTEXT MENU HANDLER =====
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'captureSelection') {
    const selectedText = info.selectionText;
    
    if (selectedText) {
      const result = await chrome.storage.local.get(['projects', 'activeProjectId']);
      const activeProject = result.projects?.find(p => p.id === result.activeProjectId);
      
      if (activeProject) {
        const updatedNotes = activeProject.notes 
          ? `${activeProject.notes}\n\n[Captured from ${new URL(tab.url).hostname}]\n${selectedText}`
          : `[Captured from ${new URL(tab.url).hostname}]\n${selectedText}`;
        
        activeProject.notes = updatedNotes;
        activeProject.updated = Date.now();
        
        const updatedProjects = result.projects.map(p => 
          p.id === activeProject.id ? activeProject : p
        );
        
        await chrome.storage.local.set({ projects: updatedProjects });
        
        showNotification('AI Context Bridge', `Added to "${activeProject.project_name}"`);
      } else {
        showNotification('AI Context Bridge', 'No active project. Open extension to create one.');
      }
    }
  }
});

// ===== AUTO-CAPTURE ON AI PLATFORM NAVIGATION =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger when page is fully loaded
  if (changeInfo.status !== 'complete') return;
  
  const url = tab.url || '';
  const platform = detectAiPlatform(url);
  
  if (!platform) return;
  
  // Get settings
  const { settings } = await chrome.storage.local.get(['settings']);
  if (!settings?.autoCapture) return;
  
  // Wait for page to fully render
  await delay(2000);
  
  // Check if content script is ready
  try {
    const response = await sendMessageToTab(tabId, { type: 'PING' });
    
    if (response?.success) {
      // Fetch conversation
      const convResponse = await sendMessageToTab(tabId, { type: 'GET_CONVERSATION' });
      
      if (convResponse?.text && convResponse.text.trim().length > 50) {
        // Create auto-captured context
        const context = {
          id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
          platform: platform,
          url: tab.url,
          title: tab.title || 'Untitled Chat',
          content: convResponse.text,
          summary: generateQuickSummary(convResponse.text),
          timestamp: Date.now()
        };
        
        // Save to captured contexts
        const { capturedContexts = [] } = await chrome.storage.local.get(['capturedContexts']);
        
        // Check if we already captured this URL recently (within last 5 minutes)
        const recentCapture = capturedContexts.find(c => 
          c.url === tab.url && (Date.now() - c.timestamp) < 5 * 60 * 1000
        );
        
        if (!recentCapture) {
          // Keep only last 20 captures
          const updatedContexts = [context, ...capturedContexts].slice(0, 20);
          await chrome.storage.local.set({ capturedContexts: updatedContexts });
          
          // Update badge
          chrome.action.setBadgeText({ text: '✓', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
          
          console.log('AI Context Bridge: Auto-captured context from', platform);
        }
      }
    }
  } catch (error) {
    console.log('AI Context Bridge: Could not auto-capture:', error.message);
  }
});

// ===== KEYBOARD SHORTCUT HANDLER =====
chrome.commands?.onCommand?.addListener(async (command) => {
  console.log('AI Context Bridge: Command received:', command);
  
  if (command === 'inject-context') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      const result = await chrome.storage.local.get(['projects', 'activeProjectId']);
      const activeProject = result.projects?.find(p => p.id === result.activeProjectId);
      
      if (activeProject) {
        const prompt = generateContextPrompt(activeProject);
        chrome.tabs.sendMessage(tab.id, {
          type: 'INJECT_CONTEXT',
          prompt: prompt
        });
      }
    }
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Detect AI platform from URL
 */
function detectAiPlatform(url) {
  const platforms = {
    'chat.openai.com': 'ChatGPT',
    'chatgpt.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'gemini.google.com': 'Gemini',
    'copilot.microsoft.com': 'Copilot',
    'poe.com': 'Poe',
    'perplexity.ai': 'Perplexity'
  };
  
  for (const [domain, name] of Object.entries(platforms)) {
    if (url.includes(domain)) return name;
  }
  return null;
}

/**
 * Generate quick summary from conversation text
 */
function generateQuickSummary(text) {
  // Take first 500 chars and find key points
  const truncated = text.slice(0, 2000);
  
  // Extract potential topics/keywords
  const lines = truncated.split('\n').filter(l => l.trim().length > 10);
  const firstFewLines = lines.slice(0, 5).join(' ');
  
  // Create a summary
  if (firstFewLines.length > 200) {
    return firstFewLines.slice(0, 200) + '...';
  }
  return firstFewLines || 'Conversation captured';
}

/**
 * Generate context prompt from project
 */
function generateContextPrompt(project) {
  if (!project) return '';
  
  const sections = [];
  sections.push('You are continuing an existing project.');
  sections.push('');
  sections.push('Context:');
  
  if (project.goal) sections.push(`- Goal: ${project.goal}`);
  if (project.current_progress) sections.push(`- Current Progress: ${project.current_progress}`);
  if (project.constraints) sections.push(`- Constraints: ${project.constraints}`);
  if (project.tech_stack) sections.push(`- Tech Stack: ${project.tech_stack}`);
  if (project.notes) sections.push(`- Notes: ${project.notes}`);
  
  sections.push('');
  sections.push('Do not ask onboarding questions.');
  sections.push('Continue from this context.');
  
  return sections.join('\n');
}

/**
 * Send message to tab with promise wrapper
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Show notification
 */
function showNotification(title, message) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title,
      message
    });
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== TAB ACTIVATION LISTENER =====
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const url = tab.url || '';
    const platform = detectAiPlatform(url);
    
    if (platform) {
      const result = await chrome.storage.local.get(['activeProjectId', 'capturedContexts']);
      
      // Check if we have a captured context for this tab
      const hasCapture = result.capturedContexts?.some(c => c.url === tab.url);
      
      if (hasCapture) {
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      } else if (result.activeProjectId) {
        chrome.action.setBadgeText({ text: '●' });
        chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.log('AI Context Bridge: Tab check error:', error);
  }
});

// ===== STORAGE CHANGE LISTENER =====
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.activeProjectId) {
    console.log('AI Context Bridge: Active project changed');
  }
});

console.log('AI Context Bridge: Background service worker started');
