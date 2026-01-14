/**
 * AI Context Bridge - Popup Script
 * Handles all UI interactions and storage management
 */

// ===== STATE =====
let projects = [];
let activeProjectId = null;
let capturedContexts = [];
let currentView = 'captured'; // Default to captured view
let selectedContextId = null;

// ===== DOM ELEMENTS =====
const elements = {
  // Views
  projectListView: document.getElementById('projectListView'),
  projectFormView: document.getElementById('projectFormView'),
  captureView: document.getElementById('captureView'),
  capturedView: document.getElementById('capturedView'),
  contextDetailView: document.getElementById('contextDetailView'),
  
  // Tabs
  tabProjects: document.getElementById('tabProjects'),
  tabCaptured: document.getElementById('tabCaptured'),
  capturedCount: document.getElementById('capturedCount'),
  
  // Project List
  projectList: document.getElementById('projectList'),
  emptyState: document.getElementById('emptyState'),
  
  // Captured List
  capturedList: document.getElementById('capturedList'),
  capturedEmptyState: document.getElementById('capturedEmptyState'),
  autoCaptureToggle: document.getElementById('autoCaptureToggle'),
  refreshCaptureBtn: document.getElementById('refreshCaptureBtn'),
  
  // Buttons
  addProjectBtn: document.getElementById('addProjectBtn'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  backBtn: document.getElementById('backBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  captureBackBtn: document.getElementById('captureBackBtn'),
  contextBackBtn: document.getElementById('contextBackBtn'),
  
  // Form
  projectForm: document.getElementById('projectForm'),
  formTitle: document.getElementById('formTitle'),
  projectId: document.getElementById('projectId'),
  projectName: document.getElementById('projectName'),
  projectGoal: document.getElementById('projectGoal'),
  projectProgress: document.getElementById('projectProgress'),
  projectConstraints: document.getElementById('projectConstraints'),
  projectTechStack: document.getElementById('projectTechStack'),
  projectNotes: document.getElementById('projectNotes'),
  
  // Capture
  captureSelection: document.getElementById('captureSelection'),
  captureConversation: document.getElementById('captureConversation'),
  capturedContent: document.getElementById('capturedContent'),
  capturedText: document.getElementById('capturedText'),
  captureTarget: document.getElementById('captureTarget'),
  saveCaptured: document.getElementById('saveCaptured'),
  
  // Context Detail
  contextDetailTitle: document.getElementById('contextDetailTitle'),
  contextPlatform: document.getElementById('contextPlatform'),
  contextTime: document.getElementById('contextTime'),
  contextContent: document.getElementById('contextContent'),
  injectContextBtn: document.getElementById('injectContextBtn'),
  copyContextBtn: document.getElementById('copyContextBtn'),
  deleteContextBtn: document.getElementById('deleteContextBtn'),
  
  // Quick Actions
  quickActions: document.getElementById('quickActions'),
  injectBtn: document.getElementById('injectBtn'),
  copyBtn: document.getElementById('copyBtn'),
  captureBtn: document.getElementById('captureBtn'),
  
  // Toast
  toast: document.getElementById('toast')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderProjectList();
  renderCapturedList();
  setupEventListeners();
  updateCapturedBadge();
});

// ===== STORAGE FUNCTIONS =====

/**
 * Load all data from chrome.storage.local
 */
async function loadData() {
  try {
    const result = await chrome.storage.local.get(['projects', 'activeProjectId', 'capturedContexts', 'settings']);
    projects = result.projects || [];
    activeProjectId = result.activeProjectId || null;
    capturedContexts = result.capturedContexts || [];
    
    // Set auto-capture toggle
    if (elements.autoCaptureToggle) {
      elements.autoCaptureToggle.checked = result.settings?.autoCapture !== false;
    }
  } catch (error) {
    console.error('Error loading data:', error);
    projects = [];
    activeProjectId = null;
    capturedContexts = [];
  }
}

/**
 * Save projects to chrome.storage.local
 */
async function saveProjects() {
  try {
    await chrome.storage.local.set({ projects, activeProjectId });
  } catch (error) {
    console.error('Error saving projects:', error);
    showToast('Error saving project', 'error');
  }
}

/**
 * Save captured contexts
 */
async function saveCapturedContexts() {
  try {
    await chrome.storage.local.set({ capturedContexts });
    updateCapturedBadge();
  } catch (error) {
    console.error('Error saving contexts:', error);
  }
}

/**
 * Save settings
 */
async function saveSettings(settings) {
  try {
    const result = await chrome.storage.local.get(['settings']);
    await chrome.storage.local.set({ 
      settings: { ...result.settings, ...settings } 
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// ===== PROJECT FUNCTIONS =====

function generateId() {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createProject(data) {
  const project = {
    id: generateId(),
    project_name: data.project_name,
    goal: data.goal || '',
    current_progress: data.current_progress || '',
    constraints: data.constraints || '',
    tech_stack: data.tech_stack || '',
    notes: data.notes || '',
    timestamp: Date.now(),
    updated: Date.now()
  };
  
  projects.push(project);
  
  if (projects.length === 1) {
    activeProjectId = project.id;
  }
  
  saveProjects();
  return project;
}

function updateProject(id, data) {
  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  projects[index] = {
    ...projects[index],
    ...data,
    updated: Date.now()
  };
  
  saveProjects();
  return projects[index];
}

function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  
  if (activeProjectId === id) {
    activeProjectId = projects.length > 0 ? projects[0].id : null;
  }
  
  saveProjects();
}

function setActiveProject(id) {
  activeProjectId = id;
  saveProjects();
  renderProjectList();
  updateQuickActions();
}

function getActiveProject() {
  return projects.find(p => p.id === activeProjectId) || null;
}

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

// ===== CAPTURED CONTEXT FUNCTIONS =====

function deleteCapturedContext(id) {
  capturedContexts = capturedContexts.filter(c => c.id !== id);
  saveCapturedContexts();
}

function getCapturedContext(id) {
  return capturedContexts.find(c => c.id === id) || null;
}

function updateCapturedBadge() {
  const count = capturedContexts.length;
  if (count > 0) {
    elements.capturedCount.textContent = count;
    elements.capturedCount.classList.remove('hidden');
  } else {
    elements.capturedCount.classList.add('hidden');
  }
}

// ===== RENDER FUNCTIONS =====

function renderProjectList() {
  if (projects.length === 0) {
    elements.projectList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    elements.quickActions.classList.add('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  
  const sortedProjects = [...projects].sort((a, b) => b.updated - a.updated);
  
  elements.projectList.innerHTML = sortedProjects.map(project => {
    const isActive = project.id === activeProjectId;
    const date = new Date(project.updated).toLocaleDateString();
    
    return `
      <div class="project-card ${isActive ? 'active' : ''}" data-id="${project.id}">
        <div class="project-indicator"></div>
        <div class="project-info">
          <div class="project-name">${escapeHtml(project.project_name)}</div>
          <div class="project-meta">Updated ${date}</div>
        </div>
        <div class="project-actions">
          <button class="edit-btn" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="delete delete-btn" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  updateQuickActions();
}

function renderCapturedList() {
  if (capturedContexts.length === 0) {
    elements.capturedList.innerHTML = '';
    elements.capturedEmptyState.classList.remove('hidden');
    return;
  }
  
  elements.capturedEmptyState.classList.add('hidden');
  
  const sortedContexts = [...capturedContexts].sort((a, b) => b.timestamp - a.timestamp);
  
  elements.capturedList.innerHTML = sortedContexts.map(ctx => {
    const time = getRelativeTime(ctx.timestamp);
    const platformClass = ctx.platform.toLowerCase().replace(/\s+/g, '-');
    
    return `
      <div class="captured-card" data-id="${ctx.id}">
        <div class="captured-header">
          <span class="platform-badge ${platformClass}">${ctx.platform}</span>
          <span class="captured-time">${time}</span>
        </div>
        <div class="captured-title">${escapeHtml(ctx.title || 'Untitled Chat')}</div>
        <div class="captured-summary">${escapeHtml(ctx.summary || 'No summary available')}</div>
        <div class="captured-actions">
          <button class="use-btn" title="Use this context">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Use
          </button>
          <button class="view-btn" title="View details">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            View
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateQuickActions() {
  const hasActive = activeProjectId && projects.length > 0;
  if (hasActive && currentView === 'list') {
    elements.quickActions.classList.remove('hidden');
  } else {
    elements.quickActions.classList.add('hidden');
  }
}

// ===== VIEW FUNCTIONS =====

function showView(view) {
  currentView = view;
  
  elements.projectListView.classList.remove('active');
  elements.projectFormView.classList.remove('active');
  elements.captureView.classList.remove('active');
  elements.capturedView.classList.remove('active');
  elements.contextDetailView.classList.remove('active');
  
  switch (view) {
    case 'list':
      elements.projectListView.classList.add('active');
      elements.tabProjects.classList.add('active');
      elements.tabCaptured.classList.remove('active');
      break;
    case 'captured':
      elements.capturedView.classList.add('active');
      elements.tabCaptured.classList.add('active');
      elements.tabProjects.classList.remove('active');
      break;
    case 'form':
      elements.projectFormView.classList.add('active');
      break;
    case 'capture':
      elements.captureView.classList.add('active');
      break;
    case 'contextDetail':
      elements.contextDetailView.classList.add('active');
      break;
  }
  
  updateQuickActions();
}

function showNewProjectForm() {
  elements.formTitle.textContent = 'New Project';
  elements.projectForm.reset();
  elements.projectId.value = '';
  showView('form');
}

function showEditProjectForm(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  
  elements.formTitle.textContent = 'Edit Project';
  elements.projectId.value = project.id;
  elements.projectName.value = project.project_name;
  elements.projectGoal.value = project.goal;
  elements.projectProgress.value = project.current_progress;
  elements.projectConstraints.value = project.constraints;
  elements.projectTechStack.value = project.tech_stack;
  elements.projectNotes.value = project.notes;
  
  showView('form');
}

function showCaptureView() {
  if (!activeProjectId) {
    showToast('Select a project first', 'error');
    return;
  }
  
  elements.capturedContent.classList.add('hidden');
  elements.capturedText.value = '';
  showView('capture');
}

function showContextDetail(id) {
  const ctx = getCapturedContext(id);
  if (!ctx) return;
  
  selectedContextId = id;
  elements.contextDetailTitle.textContent = ctx.title || 'Captured Context';
  elements.contextPlatform.textContent = ctx.platform;
  elements.contextPlatform.className = 'platform-badge ' + ctx.platform.toLowerCase().replace(/\s+/g, '-');
  elements.contextTime.textContent = getRelativeTime(ctx.timestamp);
  elements.contextContent.value = ctx.content;
  
  showView('contextDetail');
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
  // Tabs
  elements.tabProjects.addEventListener('click', () => showView('list'));
  elements.tabCaptured.addEventListener('click', () => {
    loadData().then(() => {
      renderCapturedList();
      showView('captured');
    });
  });
  
  // Add project buttons
  elements.addProjectBtn.addEventListener('click', showNewProjectForm);
  elements.emptyAddBtn.addEventListener('click', showNewProjectForm);
  
  // Back/Cancel buttons
  elements.backBtn.addEventListener('click', () => showView('list'));
  elements.cancelBtn.addEventListener('click', () => showView('list'));
  elements.captureBackBtn.addEventListener('click', () => showView('list'));
  elements.contextBackBtn.addEventListener('click', () => showView('captured'));
  
  // Form submission
  elements.projectForm.addEventListener('submit', handleFormSubmit);
  
  // Project list interactions
  elements.projectList.addEventListener('click', handleProjectListClick);
  
  // Captured list interactions
  elements.capturedList.addEventListener('click', handleCapturedListClick);
  
  // Quick actions
  elements.injectBtn.addEventListener('click', handleInject);
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.captureBtn.addEventListener('click', showCaptureView);
  
  // Capture actions
  elements.captureSelection.addEventListener('click', handleCaptureSelection);
  elements.captureConversation.addEventListener('click', handleCaptureConversation);
  elements.saveCaptured.addEventListener('click', handleSaveCaptured);
  
  // Context detail actions
  elements.injectContextBtn.addEventListener('click', handleInjectContext);
  elements.copyContextBtn.addEventListener('click', handleCopyContext);
  elements.deleteContextBtn.addEventListener('click', handleDeleteContext);
  
  // Auto-capture toggle
  elements.autoCaptureToggle?.addEventListener('change', (e) => {
    saveSettings({ autoCapture: e.target.checked });
    showToast(e.target.checked ? 'Auto-capture enabled' : 'Auto-capture disabled');
  });
  
  // Refresh/Manual capture button
  elements.refreshCaptureBtn?.addEventListener('click', handleManualCapture);
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  const data = {
    project_name: elements.projectName.value.trim(),
    goal: elements.projectGoal.value.trim(),
    current_progress: elements.projectProgress.value.trim(),
    constraints: elements.projectConstraints.value.trim(),
    tech_stack: elements.projectTechStack.value.trim(),
    notes: elements.projectNotes.value.trim()
  };
  
  const id = elements.projectId.value;
  
  if (id) {
    updateProject(id, data);
    showToast('Project updated');
  } else {
    const newProject = createProject(data);
    setActiveProject(newProject.id);
    showToast('Project created');
  }
  
  renderProjectList();
  showView('list');
}

function handleProjectListClick(e) {
  const card = e.target.closest('.project-card');
  if (!card) return;
  
  const id = card.dataset.id;
  
  if (e.target.closest('.edit-btn')) {
    showEditProjectForm(id);
    return;
  }
  
  if (e.target.closest('.delete-btn')) {
    if (confirm('Delete this project?')) {
      deleteProject(id);
      renderProjectList();
      showToast('Project deleted');
    }
    return;
  }
  
  setActiveProject(id);
  showToast('Project activated');
}

function handleCapturedListClick(e) {
  const card = e.target.closest('.captured-card');
  if (!card) return;
  
  const id = card.dataset.id;
  
  if (e.target.closest('.use-btn')) {
    handleUseContext(id);
    return;
  }
  
  if (e.target.closest('.view-btn')) {
    showContextDetail(id);
    return;
  }
  
  // Click on card itself opens detail
  showContextDetail(id);
}

async function handleInject() {
  const project = getActiveProject();
  if (!project) {
    showToast('No active project', 'error');
    return;
  }
  
  const prompt = generateContextPrompt(project);
  await injectOrCopy(prompt);
}

async function handleCopy() {
  const project = getActiveProject();
  if (!project) {
    showToast('No active project', 'error');
    return;
  }
  
  const prompt = generateContextPrompt(project);
  await copyToClipboard(prompt);
  showToast('Copied to clipboard', 'success');
}

async function handleUseContext(id) {
  const ctx = getCapturedContext(id);
  if (!ctx) return;
  
  const prompt = formatCapturedContext(ctx);
  await injectOrCopy(prompt);
}

async function handleInjectContext() {
  const ctx = getCapturedContext(selectedContextId);
  if (!ctx) return;
  
  const prompt = formatCapturedContext(ctx);
  await injectOrCopy(prompt);
}

async function handleCopyContext() {
  const ctx = getCapturedContext(selectedContextId);
  if (!ctx) return;
  
  const prompt = formatCapturedContext(ctx);
  await copyToClipboard(prompt);
  showToast('Copied to clipboard', 'success');
}

function handleDeleteContext() {
  if (confirm('Delete this captured context?')) {
    deleteCapturedContext(selectedContextId);
    renderCapturedList();
    showView('captured');
    showToast('Context deleted');
  }
}

function formatCapturedContext(ctx) {
  return `Continue from this previous conversation context:

Platform: ${ctx.platform}
Captured: ${new Date(ctx.timestamp).toLocaleString()}

Previous conversation:
${ctx.content}

Do not re-explain or ask onboarding questions. Continue from where we left off.`;
}

async function injectOrCopy(prompt) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      await copyToClipboard(prompt);
      showToast('Copied to clipboard');
      return;
    }
    
    chrome.tabs.sendMessage(tab.id, {
      type: 'INJECT_CONTEXT',
      prompt: prompt
    }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        copyToClipboard(prompt);
        showToast('Copied to clipboard');
      } else {
        showToast('Context injected!', 'success');
      }
    });
  } catch (error) {
    await copyToClipboard(prompt);
    showToast('Copied to clipboard');
  }
}

/**
 * Manual capture - fetch current chat from active AI tab
 */
async function handleManualCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url) {
      showToast('No active tab', 'error');
      return;
    }
    
    // Check if it's an AI platform
    const aiPlatforms = {
      'chat.openai.com': 'ChatGPT',
      'chatgpt.com': 'ChatGPT',
      'claude.ai': 'Claude',
      'gemini.google.com': 'Gemini',
      'copilot.microsoft.com': 'Copilot',
      'poe.com': 'Poe',
      'perplexity.ai': 'Perplexity'
    };
    
    let platform = null;
    for (const [domain, name] of Object.entries(aiPlatforms)) {
      if (tab.url.includes(domain)) {
        platform = name;
        break;
      }
    }
    
    if (!platform) {
      showToast('Open an AI chat first (ChatGPT, Claude, etc.)', 'error');
      return;
    }
    
    showToast('Capturing...', 'info');
    
    chrome.tabs.sendMessage(tab.id, { type: 'GET_CONVERSATION' }, async (response) => {
      if (chrome.runtime.lastError) {
        showToast('Cannot capture - reload the page and try again', 'error');
        return;
      }
      
      if (!response?.text || response.text.trim().length < 20) {
        showToast('No conversation found on this page', 'error');
        return;
      }
      
      // Create captured context
      const context = {
        id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        platform: platform,
        url: tab.url,
        title: tab.title || 'Untitled Chat',
        content: response.text,
        summary: response.text.slice(0, 200) + (response.text.length > 200 ? '...' : ''),
        timestamp: Date.now()
      };
      
      // Save to captured contexts
      await loadData();
      
      // Remove existing capture of same URL if any
      capturedContexts = capturedContexts.filter(c => c.url !== tab.url);
      
      // Add new capture at the top
      capturedContexts = [context, ...capturedContexts].slice(0, 20);
      await saveCapturedContexts();
      
      renderCapturedList();
      showToast(`Captured from ${platform}!`, 'success');
    });
  } catch (error) {
    console.error('Manual capture error:', error);
    showToast('Capture failed', 'error');
  }
}

async function handleCaptureSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showToast('No active tab', 'error');
      return;
    }
    
    chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }, (response) => {
      if (chrome.runtime.lastError) {
        showToast('Cannot capture from this page', 'error');
        return;
      }
      
      if (response?.text) {
        elements.capturedText.value = response.text;
        elements.capturedContent.classList.remove('hidden');
      } else {
        showToast('No text selected', 'error');
      }
    });
  } catch (error) {
    showToast('Capture failed', 'error');
  }
}

async function handleCaptureConversation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showToast('No active tab', 'error');
      return;
    }
    
    chrome.tabs.sendMessage(tab.id, { type: 'GET_CONVERSATION' }, (response) => {
      if (chrome.runtime.lastError) {
        showToast('Cannot capture from this page', 'error');
        return;
      }
      
      if (response?.text) {
        elements.capturedText.value = response.text;
        elements.capturedContent.classList.remove('hidden');
      } else {
        showToast('No conversation found', 'error');
      }
    });
  } catch (error) {
    showToast('Capture failed', 'error');
  }
}

function handleSaveCaptured() {
  const project = getActiveProject();
  if (!project) {
    showToast('No active project', 'error');
    return;
  }
  
  const text = elements.capturedText.value.trim();
  if (!text) {
    showToast('No content to save', 'error');
    return;
  }
  
  const target = elements.captureTarget.value;
  const currentValue = project[target] || '';
  const newValue = currentValue ? `${currentValue}\n\n${text}` : text;
  
  updateProject(project.id, { [target]: newValue });
  
  showToast('Content saved to project', 'success');
  elements.capturedContent.classList.add('hidden');
  elements.capturedText.value = '';
}

// ===== UTILITY FUNCTIONS =====

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Clipboard error:', error);
    return false;
  }
}

function showToast(message, type = '') {
  elements.toast.textContent = message;
  elements.toast.className = 'toast show';
  if (type) {
    elements.toast.classList.add(type);
  }
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}
