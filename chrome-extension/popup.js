/**
 * AI Context Bridge - Popup Script
 * Handles all UI interactions and storage management
 */

// ===== STATE =====
let projects = [];
let activeProjectId = null;
let currentView = 'list';

// ===== DOM ELEMENTS =====
const elements = {
  // Views
  projectListView: document.getElementById('projectListView'),
  projectFormView: document.getElementById('projectFormView'),
  captureView: document.getElementById('captureView'),
  
  // Project List
  projectList: document.getElementById('projectList'),
  emptyState: document.getElementById('emptyState'),
  
  // Buttons
  addProjectBtn: document.getElementById('addProjectBtn'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  backBtn: document.getElementById('backBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  captureBackBtn: document.getElementById('captureBackBtn'),
  
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
  await loadProjects();
  renderProjectList();
  setupEventListeners();
});

// ===== STORAGE FUNCTIONS =====

/**
 * Load projects from chrome.storage.local
 */
async function loadProjects() {
  try {
    const result = await chrome.storage.local.get(['projects', 'activeProjectId']);
    projects = result.projects || [];
    activeProjectId = result.activeProjectId || null;
  } catch (error) {
    console.error('Error loading projects:', error);
    projects = [];
    activeProjectId = null;
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

// ===== PROJECT FUNCTIONS =====

/**
 * Generate unique ID for projects
 */
function generateId() {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Create a new project
 */
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
  
  // Set as active if it's the first project
  if (projects.length === 1) {
    activeProjectId = project.id;
  }
  
  saveProjects();
  return project;
}

/**
 * Update an existing project
 */
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

/**
 * Delete a project
 */
function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  
  // Clear active if deleted
  if (activeProjectId === id) {
    activeProjectId = projects.length > 0 ? projects[0].id : null;
  }
  
  saveProjects();
}

/**
 * Set active project
 */
function setActiveProject(id) {
  activeProjectId = id;
  saveProjects();
  renderProjectList();
  updateQuickActions();
}

/**
 * Get active project
 */
function getActiveProject() {
  return projects.find(p => p.id === activeProjectId) || null;
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

// ===== RENDER FUNCTIONS =====

/**
 * Render the project list
 */
function renderProjectList() {
  if (projects.length === 0) {
    elements.projectList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    elements.quickActions.classList.add('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  
  // Sort by updated date
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

/**
 * Update quick actions visibility
 */
function updateQuickActions() {
  const hasActive = activeProjectId && projects.length > 0;
  if (hasActive && currentView === 'list') {
    elements.quickActions.classList.remove('hidden');
  } else {
    elements.quickActions.classList.add('hidden');
  }
}

// ===== VIEW FUNCTIONS =====

/**
 * Switch between views
 */
function showView(view) {
  currentView = view;
  
  elements.projectListView.classList.remove('active');
  elements.projectFormView.classList.remove('active');
  elements.captureView.classList.remove('active');
  
  switch (view) {
    case 'list':
      elements.projectListView.classList.add('active');
      break;
    case 'form':
      elements.projectFormView.classList.add('active');
      break;
    case 'capture':
      elements.captureView.classList.add('active');
      break;
  }
  
  updateQuickActions();
}

/**
 * Show form for new project
 */
function showNewProjectForm() {
  elements.formTitle.textContent = 'New Project';
  elements.projectForm.reset();
  elements.projectId.value = '';
  showView('form');
}

/**
 * Show form for editing project
 */
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

/**
 * Show capture view
 */
function showCaptureView() {
  if (!activeProjectId) {
    showToast('Select a project first', 'error');
    return;
  }
  
  elements.capturedContent.classList.add('hidden');
  elements.capturedText.value = '';
  showView('capture');
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
  // Add project buttons
  elements.addProjectBtn.addEventListener('click', showNewProjectForm);
  elements.emptyAddBtn.addEventListener('click', showNewProjectForm);
  
  // Back/Cancel buttons
  elements.backBtn.addEventListener('click', () => showView('list'));
  elements.cancelBtn.addEventListener('click', () => showView('list'));
  elements.captureBackBtn.addEventListener('click', () => showView('list'));
  
  // Form submission
  elements.projectForm.addEventListener('submit', handleFormSubmit);
  
  // Project list interactions
  elements.projectList.addEventListener('click', handleProjectListClick);
  
  // Quick actions
  elements.injectBtn.addEventListener('click', handleInject);
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.captureBtn.addEventListener('click', showCaptureView);
  
  // Capture actions
  elements.captureSelection.addEventListener('click', handleCaptureSelection);
  elements.captureConversation.addEventListener('click', handleCaptureConversation);
  elements.saveCaptured.addEventListener('click', handleSaveCaptured);
}

/**
 * Handle form submission
 */
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

/**
 * Handle clicks on project list
 */
function handleProjectListClick(e) {
  const card = e.target.closest('.project-card');
  if (!card) return;
  
  const id = card.dataset.id;
  
  // Check if edit button was clicked
  if (e.target.closest('.edit-btn')) {
    showEditProjectForm(id);
    return;
  }
  
  // Check if delete button was clicked
  if (e.target.closest('.delete-btn')) {
    if (confirm('Delete this project?')) {
      deleteProject(id);
      renderProjectList();
      showToast('Project deleted');
    }
    return;
  }
  
  // Otherwise, set as active
  setActiveProject(id);
  showToast('Project activated');
}

/**
 * Handle inject button click
 */
async function handleInject() {
  const project = getActiveProject();
  if (!project) {
    showToast('No active project', 'error');
    return;
  }
  
  const prompt = generateContextPrompt(project);
  
  try {
    // Send message to content script
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
        // Fallback to clipboard
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
 * Handle copy button click
 */
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

/**
 * Handle capture selection
 */
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

/**
 * Handle capture conversation
 */
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

/**
 * Handle save captured content
 */
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

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Clipboard error:', error);
    return false;
  }
}

/**
 * Show toast notification
 */
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
