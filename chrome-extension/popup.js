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
    const techPreview = ctx.techStack?.length > 0 ? ctx.techStack.slice(0, 3).join(', ') : '';
    const keyPointsCount = ctx.keyPoints?.length || 0;
    const msgCount = ctx.messageCount ? `${ctx.messageCount.user + ctx.messageCount.ai} msgs` : '';
    
    return `
      <div class="captured-card" data-id="${ctx.id}">
        <div class="captured-header">
          <span class="platform-badge ${platformClass}">${ctx.platform}</span>
          <span class="captured-time">${time}</span>
        </div>
        <div class="captured-title">${escapeHtml(ctx.title || 'Untitled Chat')}</div>
        <div class="captured-summary">${escapeHtml(ctx.summary || 'No summary available')}</div>
        ${techPreview || keyPointsCount || msgCount ? `
          <div class="captured-meta">
            ${techPreview ? `<span class="meta-tag tech">🛠️ ${techPreview}</span>` : ''}
            ${keyPointsCount ? `<span class="meta-tag points">💡 ${keyPointsCount} points</span>` : ''}
            ${msgCount ? `<span class="meta-tag msgs">💬 ${msgCount}</span>` : ''}
          </div>
        ` : ''}
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
  
  // Build detailed content view
  let detailContent = '';
  
  // Summary
  if (ctx.summary) {
    detailContent += `📋 SUMMARY\n${ctx.summary}\n\n`;
  }
  
  // Key Points
  if (ctx.keyPoints && ctx.keyPoints.length > 0) {
    detailContent += `💡 KEY POINTS\n`;
    ctx.keyPoints.forEach((point, i) => {
      detailContent += `${i + 1}. ${point}\n`;
    });
    detailContent += '\n';
  }
  
  // Tech Stack
  if (ctx.techStack && ctx.techStack.length > 0) {
    detailContent += `🛠️ TECH STACK\n${ctx.techStack.join(', ')}\n\n`;
  }
  
  // Decisions
  if (ctx.decisions && ctx.decisions.length > 0) {
    detailContent += `✅ DECISIONS MADE\n`;
    ctx.decisions.forEach((d, i) => {
      detailContent += `• ${d}\n`;
    });
    detailContent += '\n';
  }
  
  // Open Questions
  if (ctx.openQuestions && ctx.openQuestions.length > 0) {
    detailContent += `❓ OPEN QUESTIONS\n`;
    ctx.openQuestions.forEach((q, i) => {
      detailContent += `• ${q}\n`;
    });
    detailContent += '\n';
  }
  
  // Message count
  if (ctx.messageCount) {
    detailContent += `💬 Messages: ${ctx.messageCount.user} user / ${ctx.messageCount.ai} AI\n\n`;
  }
  
  // Raw content (collapsed or truncated)
  detailContent += `─────────────────────────\n📜 RAW CONVERSATION\n─────────────────────────\n`;
  detailContent += ctx.rawContent || ctx.content || 'No raw content available';
  
  elements.contextContent.value = detailContent;
  
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
  let prompt = `Continue from this previous conversation context:\n\n`;
  prompt += `Platform: ${ctx.platform}\n`;
  prompt += `Topic: ${ctx.title}\n`;
  prompt += `Captured: ${new Date(ctx.timestamp).toLocaleString()}\n\n`;
  
  // Add structured context if available
  if (ctx.summary) {
    prompt += `Summary: ${ctx.summary}\n\n`;
  }
  
  if (ctx.keyPoints && ctx.keyPoints.length > 0) {
    prompt += `Key Points from Previous Discussion:\n`;
    ctx.keyPoints.forEach((point, i) => {
      prompt += `${i + 1}. ${point}\n`;
    });
    prompt += '\n';
  }
  
  if (ctx.techStack && ctx.techStack.length > 0) {
    prompt += `Tech Stack: ${ctx.techStack.join(', ')}\n\n`;
  }
  
  if (ctx.decisions && ctx.decisions.length > 0) {
    prompt += `Decisions Made:\n`;
    ctx.decisions.forEach(d => {
      prompt += `• ${d}\n`;
    });
    prompt += '\n';
  }
  
  if (ctx.openQuestions && ctx.openQuestions.length > 0) {
    prompt += `Open Questions to Address:\n`;
    ctx.openQuestions.forEach(q => {
      prompt += `• ${q}\n`;
    });
    prompt += '\n';
  }
  
  prompt += `Do not re-explain basics or ask onboarding questions. Continue from where we left off.`;
  
  return prompt;
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
      
      // Generate detailed context from raw text
      const detailedContext = generateDetailedContextFromText(response.text, platform, tab.title);
      
      // Create captured context with detailed analysis
      const context = {
        id: 'ctx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        platform: platform,
        url: tab.url,
        title: detailedContext.topic || tab.title || 'Untitled Chat',
        rawContent: response.text,
        summary: detailedContext.summary,
        keyPoints: detailedContext.keyPoints,
        techStack: detailedContext.techStack,
        decisions: detailedContext.decisions,
        openQuestions: detailedContext.openQuestions,
        messageCount: detailedContext.messageCount,
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

// ===== CONTEXT ANALYSIS FUNCTIONS =====

/**
 * Generate detailed structured context from conversation text (for manual capture)
 */
function generateDetailedContextFromText(text, platform, title) {
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
  const topic = extractTopicFromMessages(userMessages, title);
  const keyPoints = extractKeyPointsFromMessages(aiMessages);
  const techStack = extractTechStackFromText(text);
  const decisions = extractDecisionsFromMessages(aiMessages);
  const openQuestions = extractOpenQuestionsFromMessages(userMessages.slice(-3));
  
  return {
    topic,
    summary: generateSummaryFromMessages(userMessages, aiMessages, topic),
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

function extractTopicFromMessages(userMessages, title) {
  if (title && !title.toLowerCase().includes('new chat') && !title.toLowerCase().includes('untitled')) {
    return title.replace(/^(claude|chatgpt|gemini|chat)\s*[-–—|:]\s*/i, '').trim();
  }
  
  const firstMessage = userMessages[0] || '';
  const words = firstMessage.split(/\s+/).slice(0, 15).join(' ');
  return words.length > 10 ? words + (firstMessage.length > words.length ? '...' : '') : 'General Discussion';
}

function extractKeyPointsFromMessages(aiMessages) {
  const points = [];
  const allText = aiMessages.join('\n');
  
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

function extractTechStackFromText(text) {
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

function extractDecisionsFromMessages(aiMessages) {
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

function extractOpenQuestionsFromMessages(recentUserMessages) {
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

function generateSummaryFromMessages(userMessages, aiMessages, topic) {
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
