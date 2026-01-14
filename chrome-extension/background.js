/**
 * AI Context Bridge - Background Service Worker
 * Handles extension lifecycle, cross-tab communication, and auto-capture
 */

// ===== INSTALLATION HANDLER =====
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('AI Context Bridge installed:', details.reason);
  
  // Initialize or migrate storage
  const defaultSettings = {
    autoCapture: true,
    showNotifications: true
  };
  
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      projects: [],
      activeProjectId: null,
      capturedContexts: [],
      settings: defaultSettings
    });
    console.log('AI Context Bridge: Storage initialized');
  } else if (details.reason === 'update') {
    // Ensure settings exist on update
    const { settings } = await chrome.storage.local.get(['settings']);
    if (!settings) {
      await chrome.storage.local.set({ settings: defaultSettings, capturedContexts: [] });
      console.log('AI Context Bridge: Settings migrated');
    }
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
  if (!tab.url) return;
  
  const platform = detectAiPlatform(tab.url);
  if (!platform) return;
  
  console.log('AI Context Bridge: Detected AI platform:', platform);
  
  // Get settings - ensure defaults if missing
  let { settings } = await chrome.storage.local.get(['settings']);
  if (!settings) {
    settings = { autoCapture: true, showNotifications: true };
    await chrome.storage.local.set({ settings });
  }
  
  if (!settings.autoCapture) {
    console.log('AI Context Bridge: Auto-capture is disabled');
    return;
  }
  
  console.log('AI Context Bridge: Auto-capture enabled, waiting for page to load...');
  
  // Wait for page to fully render (AI sites are usually slow)
  await delay(3000);
  
  // Try to capture conversation
  try {
    // First check if content script is ready
    const pingResponse = await sendMessageToTab(tabId, { type: 'PING' });
    console.log('AI Context Bridge: Ping response:', pingResponse);
    
    if (!pingResponse?.success) {
      console.log('AI Context Bridge: Content script not ready');
      return;
    }
    
    // Fetch conversation
    const convResponse = await sendMessageToTab(tabId, { type: 'GET_CONVERSATION' });
    console.log('AI Context Bridge: Conversation response length:', convResponse?.text?.length || 0);
    
    if (!convResponse?.text || convResponse.text.trim().length < 20) {
      console.log('AI Context Bridge: No conversation content found (might be empty chat)');
      return;
    }
    
    // Create detailed structured context
    const detailedContext = generateDetailedContext(convResponse.text, platform, tab.title);
    
    const context = {
      id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      platform: platform,
      url: tab.url,
      title: detailedContext.topic || tab.title || 'Untitled Chat',
      rawContent: convResponse.text,
      summary: detailedContext.summary,
      keyPoints: detailedContext.keyPoints,
      techStack: detailedContext.techStack,
      decisions: detailedContext.decisions,
      openQuestions: detailedContext.openQuestions,
      messageCount: detailedContext.messageCount,
      timestamp: Date.now()
    };
    
    // Save to captured contexts
    let { capturedContexts = [] } = await chrome.storage.local.get(['capturedContexts']);
    if (!Array.isArray(capturedContexts)) capturedContexts = [];
    
    // Check if we already captured this URL recently (within last 2 minutes)
    const recentCapture = capturedContexts.find(c => 
      c.url === tab.url && (Date.now() - c.timestamp) < 2 * 60 * 1000
    );
    
    if (recentCapture) {
      console.log('AI Context Bridge: Already captured this chat recently');
      return;
    }
    
    // Keep only last 20 captures
    const updatedContexts = [context, ...capturedContexts].slice(0, 20);
    await chrome.storage.local.set({ capturedContexts: updatedContexts });
    
    // Update badge
    chrome.action.setBadgeText({ text: '✓', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    
    console.log('AI Context Bridge: ✓ Auto-captured context from', platform, '- Content length:', context.content.length);
    
    // Show notification if enabled
    if (settings.showNotifications) {
      showNotification('Context Captured', `Saved chat from ${platform}`);
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
 * Generate detailed structured context from conversation text
 */
function generateDetailedContext(text, platform, title) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  // Identify conversation structure
  const userMessages = [];
  const aiMessages = [];
  let currentSpeaker = null;
  let currentMessage = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    // Detect speaker changes
    if (lowerLine.startsWith('you:') || lowerLine.startsWith('user:') || lowerLine.startsWith('human:')) {
      if (currentMessage.length > 0 && currentSpeaker) {
        if (currentSpeaker === 'user') userMessages.push(currentMessage.join('\n'));
        else aiMessages.push(currentMessage.join('\n'));
      }
      currentSpeaker = 'user';
      currentMessage = [line.replace(/^(you|user|human):\s*/i, '')];
    } else if (lowerLine.startsWith('assistant:') || lowerLine.startsWith('chatgpt:') || 
               lowerLine.startsWith('claude:') || lowerLine.startsWith('gemini:') ||
               lowerLine.startsWith('ai:') || lowerLine.startsWith('copilot:')) {
      if (currentMessage.length > 0 && currentSpeaker) {
        if (currentSpeaker === 'user') userMessages.push(currentMessage.join('\n'));
        else aiMessages.push(currentMessage.join('\n'));
      }
      currentSpeaker = 'ai';
      currentMessage = [line.replace(/^(assistant|chatgpt|claude|gemini|ai|copilot):\s*/i, '')];
    } else if (currentSpeaker) {
      currentMessage.push(line);
    } else {
      // If no speaker detected yet, try to infer from content
      if (line.length > 50) {
        currentSpeaker = 'ai';
        currentMessage = [line];
      } else {
        currentSpeaker = 'user';
        currentMessage = [line];
      }
    }
  }
  
  // Push last message
  if (currentMessage.length > 0 && currentSpeaker) {
    if (currentSpeaker === 'user') userMessages.push(currentMessage.join('\n'));
    else aiMessages.push(currentMessage.join('\n'));
  }
  
  // Extract key information
  const topic = extractTopic(userMessages, title);
  const keyPoints = extractKeyPoints(aiMessages);
  const techStack = extractTechStack(text);
  const decisions = extractDecisions(aiMessages);
  const openQuestions = extractOpenQuestions(userMessages.slice(-3));
  
  return {
    topic,
    summary: generateSummary(userMessages, aiMessages, topic),
    keyPoints,
    techStack,
    decisions,
    openQuestions,
    messageCount: {
      user: userMessages.length,
      ai: aiMessages.length
    }
  };
}

/**
 * Extract the main topic from user messages
 */
function extractTopic(userMessages, title) {
  if (title && !title.toLowerCase().includes('new chat') && !title.toLowerCase().includes('untitled')) {
    return title.replace(/^(claude|chatgpt|gemini|chat)\s*[-–—|:]\s*/i, '').trim();
  }
  
  const firstMessage = userMessages[0] || '';
  const words = firstMessage.split(/\s+/).slice(0, 15).join(' ');
  return words.length > 10 ? words + (firstMessage.length > words.length ? '...' : '') : 'General Discussion';
}

/**
 * Extract key points from AI responses
 */
function extractKeyPoints(aiMessages) {
  const points = [];
  const allText = aiMessages.join('\n');
  
  // Look for numbered lists, bullet points, headers
  const patterns = [
    /(?:^|\n)\s*(?:\d+\.|\*|-|•)\s*(.{20,100})/g,
    /(?:^|\n)#{1,3}\s*(.{10,80})/g,
    /(?:key|important|note|remember|crucial):\s*(.{20,150})/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(allText)) !== null && points.length < 5) {
      const point = match[1].trim();
      if (point.length > 10 && !points.some(p => p.toLowerCase() === point.toLowerCase())) {
        points.push(point);
      }
    }
  }
  
  return points.slice(0, 5);
}

/**
 * Extract tech stack mentions
 */
function extractTechStack(text) {
  const techPatterns = [
    /\b(react|vue|angular|svelte|next\.?js|nuxt|gatsby)\b/gi,
    /\b(node\.?js|express|fastify|nest\.?js|deno|bun)\b/gi,
    /\b(python|django|flask|fastapi)\b/gi,
    /\b(typescript|javascript|rust|go|java|kotlin|swift)\b/gi,
    /\b(postgresql|mysql|mongodb|redis|supabase|firebase)\b/gi,
    /\b(tailwind|css|sass|styled-components)\b/gi,
    /\b(docker|kubernetes|aws|gcp|azure|vercel|netlify)\b/gi,
    /\b(graphql|rest\s*api|trpc)\b/gi
  ];
  
  const found = new Set();
  for (const pattern of techPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      found.add(match[1]);
    }
  }
  
  return [...found].slice(0, 10);
}

/**
 * Extract decisions made in the conversation
 */
function extractDecisions(aiMessages) {
  const decisions = [];
  const decisionPatterns = [
    /(?:we(?:'ll| will| should)|you should|let's|i(?:'ll| will) |recommend|suggest)\s+(.{20,100})/gi,
    /(?:decision|approach|solution|plan):\s*(.{20,100})/gi
  ];
  
  const allText = aiMessages.slice(-5).join('\n');
  
  for (const pattern of decisionPatterns) {
    let match;
    while ((match = pattern.exec(allText)) !== null && decisions.length < 3) {
      const decision = match[1].trim().replace(/[.!?]$/, '');
      if (decision.length > 15) {
        decisions.push(decision);
      }
    }
  }
  
  return decisions;
}

/**
 * Extract open questions from recent messages
 */
function extractOpenQuestions(recentUserMessages) {
  const questions = [];
  const text = recentUserMessages.join('\n');
  
  const questionPattern = /([^.!?\n]*\?)/g;
  let match;
  while ((match = questionPattern.exec(text)) !== null && questions.length < 3) {
    const q = match[1].trim();
    if (q.length > 10 && q.length < 200) {
      questions.push(q);
    }
  }
  
  return questions;
}

/**
 * Generate a concise summary
 */
function generateSummary(userMessages, aiMessages, topic) {
  const totalMessages = userMessages.length + aiMessages.length;
  
  if (totalMessages === 0) {
    return 'Empty conversation';
  }
  
  const lastUserMessage = userMessages[userMessages.length - 1] || '';
  const lastUserSnippet = lastUserMessage.slice(0, 100).trim();
  
  let summary = `Discussion about "${topic}"`;
  summary += ` with ${totalMessages} messages.`;
  
  if (lastUserSnippet) {
    summary += ` Last topic: ${lastUserSnippet}${lastUserMessage.length > 100 ? '...' : ''}`;
  }
  
  return summary;
}

/**
 * Generate quick summary (for backwards compatibility)
 */
function generateQuickSummary(text) {
  const truncated = text.slice(0, 2000);
  const lines = truncated.split('\n').filter(l => l.trim().length > 10);
  const firstFewLines = lines.slice(0, 5).join(' ');
  
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
