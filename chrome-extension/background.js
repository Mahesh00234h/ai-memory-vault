/**
 * AI Context Bridge - Background Service Worker
 * Handles extension lifecycle and cross-tab communication
 */

// ===== INSTALLATION HANDLER =====
chrome.runtime.onInstalled.addListener((details) => {
  console.log('AI Context Bridge installed:', details.reason);
  
  // Initialize storage on first install
  if (details.reason === 'install') {
    chrome.storage.local.set({
      projects: [],
      activeProjectId: null,
      settings: {
        autoInject: false,
        showNotifications: true
      }
    });
    
    console.log('AI Context Bridge: Storage initialized');
  }
});

// ===== CONTEXT MENU SETUP =====
// Create context menu items for quick capture
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing items first
  chrome.contextMenus.removeAll(() => {
    // Add "Capture Selection" context menu
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
      // Get active project
      const result = await chrome.storage.local.get(['projects', 'activeProjectId']);
      const activeProject = result.projects?.find(p => p.id === result.activeProjectId);
      
      if (activeProject) {
        // Append to notes
        const updatedNotes = activeProject.notes 
          ? `${activeProject.notes}\n\n[Captured from ${new URL(tab.url).hostname}]\n${selectedText}`
          : `[Captured from ${new URL(tab.url).hostname}]\n${selectedText}`;
        
        activeProject.notes = updatedNotes;
        activeProject.updated = Date.now();
        
        // Save back
        const updatedProjects = result.projects.map(p => 
          p.id === activeProject.id ? activeProject : p
        );
        
        await chrome.storage.local.set({ projects: updatedProjects });
        
        // Show notification if available
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Context Bridge',
            message: `Added to "${activeProject.project_name}"`
          });
        }
      } else {
        // No active project
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Context Bridge',
            message: 'No active project. Open extension to create one.'
          });
        }
      }
    }
  }
});

// ===== KEYBOARD SHORTCUT HANDLER =====
chrome.commands?.onCommand?.addListener(async (command) => {
  console.log('AI Context Bridge: Command received:', command);
  
  if (command === 'inject-context') {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Get active project
      const result = await chrome.storage.local.get(['projects', 'activeProjectId']);
      const activeProject = result.projects?.find(p => p.id === result.activeProjectId);
      
      if (activeProject) {
        const prompt = generateContextPrompt(activeProject);
        
        // Send to content script
        chrome.tabs.sendMessage(tab.id, {
          type: 'INJECT_CONTEXT',
          prompt: prompt
        });
      }
    }
  }
});

/**
 * Generate context prompt from project
 */
function generateContextPrompt(project) {
  if (!project) return '';
  
  const sections = [];
  
  sections.push('You are continuing an existing project.');
  sections.push('');
  sections.push('Context:');
  
  if (project.goal) {
    sections.push(`- Goal: ${project.goal}`);
  }
  if (project.current_progress) {
    sections.push(`- Current Progress: ${project.current_progress}`);
  }
  if (project.constraints) {
    sections.push(`- Constraints: ${project.constraints}`);
  }
  if (project.tech_stack) {
    sections.push(`- Tech Stack: ${project.tech_stack}`);
  }
  if (project.notes) {
    sections.push(`- Notes: ${project.notes}`);
  }
  
  sections.push('');
  sections.push('Do not ask onboarding questions.');
  sections.push('Continue from this context.');
  
  return sections.join('\n');
}

// ===== TAB ACTIVATION LISTENER =====
// Track when user switches to AI tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const url = tab.url || '';
    
    // Check if it's an AI platform
    const aiPlatforms = [
      'chat.openai.com',
      'chatgpt.com',
      'claude.ai',
      'gemini.google.com',
      'copilot.microsoft.com',
      'poe.com',
      'perplexity.ai'
    ];
    
    const isAiPlatform = aiPlatforms.some(platform => url.includes(platform));
    
    if (isAiPlatform) {
      // Update badge to show there's an active context
      const result = await chrome.storage.local.get(['activeProjectId']);
      if (result.activeProjectId) {
        chrome.action.setBadgeText({ text: '●' });
        chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    // Tab might not exist anymore
    console.log('AI Context Bridge: Tab check error:', error);
  }
});

// ===== STORAGE CHANGE LISTENER =====
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.activeProjectId) {
      console.log('AI Context Bridge: Active project changed');
    }
  }
});

console.log('AI Context Bridge: Background service worker started');
