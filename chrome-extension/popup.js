/**
 * AI Context Bridge - Popup Script
 * Handles all UI interactions, storage management, and cloud sync
 */

// ===== STATE =====
let projects = [];
let activeProjectId = null;
let capturedContexts = [];
let currentView = 'captured';
let selectedContextId = null;
let currentUser = null;
let currentTeam = null;
let teamContexts = [];
let teamSummaries = [];
let isOnline = navigator.onLine;
let lastSyncTime = null;
let syncQueueLength = 0;

// V2 Auth State
let v2Session = null; // { accessToken, user, expiresAt }
let isV2Authenticated = false;
let v2SessionExpiresAt = null;

// ===== DOM ELEMENTS =====
const elements = {
  // Onboarding
  onboardingView: document.getElementById('onboardingView'),
  onboardingForm: document.getElementById('onboardingForm'),
  userName: document.getElementById('userName'),
  mainApp: document.getElementById('mainApp'),
  userNameDisplay: document.getElementById('userNameDisplay'),
  syncStatusBtn: document.getElementById('syncStatusBtn'),
  
  // V2 Auth Elements
  v2AuthBanner: document.getElementById('v2AuthBanner'),
  v2AuthStatus: document.getElementById('v2AuthStatus'),
  v2LoginBtn: document.getElementById('v2LoginBtn'),
  v2UserEmail: document.getElementById('v2UserEmail'),
  v2MigrateBtn: document.getElementById('v2MigrateBtn'),
  v2RefreshBtn: document.getElementById('v2RefreshBtn'),
  
  // Views
  projectListView: document.getElementById('projectListView'),
  projectFormView: document.getElementById('projectFormView'),
  captureView: document.getElementById('captureView'),
  capturedView: document.getElementById('capturedView'),
  contextDetailView: document.getElementById('contextDetailView'),
  teamView: document.getElementById('teamView'),
  teamFormView: document.getElementById('teamFormView'),
  
  // Tabs
  tabProjects: document.getElementById('tabProjects'),
  tabCaptured: document.getElementById('tabCaptured'),
  tabTeam: document.getElementById('tabTeam'),
  capturedCount: document.getElementById('capturedCount'),
  teamBadge: document.getElementById('teamBadge'),
  
  // Team views
  noTeamView: document.getElementById('noTeamView'),
  teamActiveView: document.getElementById('teamActiveView'),
  createTeamBtn: document.getElementById('createTeamBtn'),
  joinTeamBtn: document.getElementById('joinTeamBtn'),
  teamNameDisplay: document.getElementById('teamNameDisplay'),
  teamMemberCount: document.getElementById('teamMemberCount'),
  shareTeamBtn: document.getElementById('shareTeamBtn'),
  leaveTeamBtn: document.getElementById('leaveTeamBtn'),
  teamContextsTab: document.getElementById('teamContextsTab'),
  teamSummaryTab: document.getElementById('teamSummaryTab'),
  teamContextsList: document.getElementById('teamContextsList'),
  teamSummariesList: document.getElementById('teamSummariesList'),
  createSummaryBtn: document.getElementById('createSummaryBtn'),
  
  // Team form
  teamFormBackBtn: document.getElementById('teamFormBackBtn'),
  teamFormTitle: document.getElementById('teamFormTitle'),
  teamForm: document.getElementById('teamForm'),
  createTeamFields: document.getElementById('createTeamFields'),
  joinTeamFields: document.getElementById('joinTeamFields'),
  teamName: document.getElementById('teamName'),
  inviteCode: document.getElementById('inviteCode'),
  teamCancelBtn: document.getElementById('teamCancelBtn'),
  teamSubmitBtn: document.getElementById('teamSubmitBtn'),
  
  // Project List
  projectList: document.getElementById('projectList'),
  emptyState: document.getElementById('emptyState'),
  
  // Captured List
  capturedList: document.getElementById('capturedList'),
  capturedEmptyState: document.getElementById('capturedEmptyState'),
  autoCaptureToggle: document.getElementById('autoCaptureToggle'),
  v2IngestToggle: document.getElementById('v2IngestToggle'),
  refreshCaptureBtn: document.getElementById('refreshCaptureBtn'),
  exportLastRawBtn: document.getElementById('exportLastRawBtn'),
  
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
  contextAuthor: document.getElementById('contextAuthor'),
  contextContent: document.getElementById('contextContent'),
  shareToTeamBtn: document.getElementById('shareToTeamBtn'),
  injectContextBtn: document.getElementById('injectContextBtn'),
  copyContextBtn: document.getElementById('copyContextBtn'),
  deleteContextBtn: document.getElementById('deleteContextBtn'),
  
  // Quick Actions
  quickActions: document.getElementById('quickActions'),
  injectBtn: document.getElementById('injectBtn'),
  copyBtn: document.getElementById('copyBtn'),
  captureBtn: document.getElementById('captureBtn'),
  recallV2Btn: document.getElementById('recallV2Btn'),
  
  // Keyboard Shortcuts
  toggleShortcuts: document.getElementById('toggleShortcuts'),
  shortcutsPanel: document.getElementById('shortcutsPanel'),
  
  // Toast
  toast: document.getElementById('toast')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('AI Context Bridge: Popup loaded');
  try {
    await checkOnboardingStatus();
  } catch (error) {
    console.error('Initialization error:', error);
    // Fallback: show onboarding if there's an error
    showOnboarding();
  }
});

async function checkOnboardingStatus() {
  console.log('Checking onboarding status...');
  try {
    const result = await chrome.storage.local.get(['userId', 'userName', 'teamId']);
    console.log('Storage result:', result);
    
    if (result.userId && result.userName) {
      // User exists
      currentUser = { id: result.userId, name: result.userName };
      console.log('User found:', currentUser.name);
      
      // Try to load team info (don't block on failure)
      if (result.teamId && window.API) {
        try {
          const teams = await window.API.getUserTeams(result.userId);
          currentTeam = teams.find(t => t.id === result.teamId) || null;
        } catch (e) {
          console.warn('Failed to load team:', e);
        }
      }
      
      showMainApp();
    } else {
      // First time user
      console.log('No user found, showing onboarding');
      showOnboarding();
    }
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    showOnboarding();
  }
}

function showOnboarding() {
  console.log('Showing onboarding view');
  if (elements.onboardingView) {
    elements.onboardingView.classList.remove('hidden');
  }
  if (elements.mainApp) {
    elements.mainApp.classList.add('hidden');
  }
  
  // Setup form listener
  if (elements.onboardingForm) {
    elements.onboardingForm.addEventListener('submit', handleOnboardingSubmit);
  }
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  
  const name = elements.userName?.value?.trim();
  if (!name) return;
  
  try {
    showToast('Setting up...', 'info');
    
    // Try to create user in cloud
    let user;
    if (window.API) {
      try {
        user = await window.API.createUser(name);
      } catch (apiError) {
        console.warn('Cloud API failed, using local only:', apiError);
        // Fallback to local-only mode
        user = { id: 'local_' + Date.now().toString(36), name: name };
      }
    } else {
      // No API, use local only
      user = { id: 'local_' + Date.now().toString(36), name: name };
    }
    
    currentUser = user;
    
    // Save locally
    await chrome.storage.local.set({
      userId: user.id,
      userName: user.name
    });
    
    showToast(`Welcome, ${name}!`, 'success');
    showMainApp();
  } catch (error) {
    console.error('Onboarding error:', error);
    showToast('Setup failed. Please try again.', 'error');
  }
}

async function showMainApp() {
  console.log('Showing main app');
  if (elements.onboardingView) {
    elements.onboardingView.classList.add('hidden');
  }
  if (elements.mainApp) {
    elements.mainApp.classList.remove('hidden');
  }
  
  // Display user name
  if (currentUser && elements.userNameDisplay) {
    elements.userNameDisplay.textContent = currentUser.name;
  }
  
  await loadData();
  renderProjectList();
  renderCapturedList();
  updateTeamView();
  setupEventListeners();
  updateCapturedBadge();
  updateSyncStatus();
  
  // Check V2 auth status
  await checkV2AuthStatus();
  
  // Try to sync with cloud (don't block on failure)
  if (window.API && currentUser && !currentUser.id.startsWith('local_')) {
    try {
      syncWithCloud();
    } catch (e) {
      console.warn('Cloud sync failed:', e);
    }
  }
}

// ===== V2 AUTH FUNCTIONS =====

async function checkV2AuthStatus() {
  if (!window.API?.detectV2Session) {
    console.log('V2 API not available');
    updateV2AuthUI(false);
    return;
  }
  
  try {
    const session = await window.API.detectV2Session();
    if (session?.accessToken && session?.user) {
      v2Session = session;
      isV2Authenticated = true;
      v2SessionExpiresAt = session.expiresAt || null;
      console.log('V2 Auth: Logged in as', session.user.email);
      updateV2AuthUI(true, session.user, session.expiresAt);
      
      // Store auth state for background script
      await chrome.storage.local.set({ 
        v2AuthToken: session.accessToken,
        v2AuthUser: session.user,
        v2SessionExpiresAt: session.expiresAt
      });
    } else {
      v2Session = null;
      isV2Authenticated = false;
      v2SessionExpiresAt = null;
      console.log('V2 Auth: Not logged in');
      updateV2AuthUI(false);
      
      // Clear stored auth state
      await chrome.storage.local.remove(['v2AuthToken', 'v2AuthUser', 'v2SessionExpiresAt']);
    }
  } catch (e) {
    console.error('V2 Auth check failed:', e);
    isV2Authenticated = false;
    updateV2AuthUI(false);
  }
}

function updateV2AuthUI(isAuthenticated, user = null, expiresAt = null) {
  const banner = elements.v2AuthBanner;
  const status = elements.v2AuthStatus;
  const emailEl = elements.v2UserEmail;
  const expiryEl = document.getElementById('v2SessionExpiry');
  
  if (!banner || !status) return;
  
  if (isAuthenticated && user) {
    banner.classList.add('hidden');
    status.classList.remove('hidden');
    if (emailEl) {
      emailEl.textContent = user.email || 'Logged in';
    }
    
    // Update session expiry indicator
    if (expiryEl && expiresAt) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresIn = expiresAt - nowSeconds;
      
      if (expiresIn <= 0) {
        expiryEl.textContent = 'Session expired';
        expiryEl.classList.add('expiring');
      } else if (expiresIn < 5 * 60) {
        expiryEl.textContent = `Expires in ${Math.floor(expiresIn / 60)}m`;
        expiryEl.classList.add('expiring');
      } else {
        const hours = Math.floor(expiresIn / 3600);
        const mins = Math.floor((expiresIn % 3600) / 60);
        expiryEl.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        expiryEl.classList.remove('expiring');
      }
      expiryEl.classList.remove('hidden');
    }
  } else {
    banner.classList.remove('hidden');
    status.classList.add('hidden');
    if (expiryEl) {
      expiryEl.classList.add('hidden');
    }
  }
}

// Listen for session updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'V2_SESSION_UPDATE') {
    console.log('V2 Session update from background:', message);
    if (message.hasSession) {
      // Refresh the full session info
      checkV2AuthStatus();
    } else {
      // Session lost
      v2Session = null;
      isV2Authenticated = false;
      v2SessionExpiresAt = null;
      updateV2AuthUI(false);
    }
  }
  return false;
});

function handleV2Login() {
  const loginUrl = window.API?.getWebAppLoginUrl?.() || 'https://id-preview--92d58f64-a466-44ec-970c-cae01f8e0034.lovable.app/login';
  chrome.tabs.create({ url: loginUrl });
}

async function handleV2Migrate() {
  if (!isV2Authenticated || !v2Session) {
    showToast('Please log in first', 'error');
    return;
  }
  
  // Get legacy user ID
  const storage = await chrome.storage.local.get(['userId']);
  const legacyUserId = storage.userId;
  
  if (!legacyUserId) {
    showToast('No legacy user found', 'info');
    return;
  }
  
  if (legacyUserId.startsWith('local_')) {
    showToast('Local-only users cannot migrate', 'error');
    return;
  }
  
  try {
    showToast('Starting migration...', 'info');
    
    // First do a dry run
    const dryResult = await window.API.migrateUserData(v2Session.accessToken, legacyUserId, true);
    
    if (dryResult.summary?.toMigrate === 0) {
      showToast('No data to migrate', 'info');
      return;
    }
    
    // Confirm with user
    const confirmMsg = `Migrate ${dryResult.summary.toMigrate} contexts to V2?`;
    if (!confirm(confirmMsg)) {
      showToast('Migration cancelled', 'info');
      return;
    }
    
    // Perform actual migration
    const result = await window.API.migrateUserData(v2Session.accessToken, legacyUserId, false);
    
    if (result.success) {
      showToast(`Migrated ${result.summary?.inserted || 0} contexts!`, 'success');
    } else {
      showToast('Migration had some errors', 'error');
      console.error('Migration errors:', result.errors);
    }
  } catch (e) {
    console.error('Migration failed:', e);
    showToast('Migration failed: ' + e.message, 'error');
  }
}

async function handleV2RefreshSession() {
  const refreshBtn = elements.v2RefreshBtn;
  
  // Add spinning animation
  refreshBtn?.classList.add('refreshing');
  
  try {
    showToast('Refreshing session...', 'info');
    await checkV2AuthStatus();
    
    if (isV2Authenticated) {
      showToast('Session refreshed!', 'success');
    } else {
      showToast('No active session found. Please log in.', 'error');
    }
  } catch (e) {
    console.error('Session refresh failed:', e);
    showToast('Refresh failed', 'error');
  } finally {
    // Remove spinning animation
    setTimeout(() => {
      refreshBtn?.classList.remove('refreshing');
    }, 300);
  }
}

// ===== STORAGE FUNCTIONS =====

async function loadData() {
  try {
    const result = await chrome.storage.local.get(['projects', 'activeProjectId', 'capturedContexts', 'settings']);
    projects = result.projects || [];
    activeProjectId = result.activeProjectId || null;
    capturedContexts = result.capturedContexts || [];
    
    if (elements.autoCaptureToggle) {
      elements.autoCaptureToggle.checked = result.settings?.autoCapture !== false;
    }
    if (elements.v2IngestToggle) {
      elements.v2IngestToggle.checked = result.settings?.useV2Ingest === true;
    }
  } catch (error) {
    console.error('Error loading data:', error);
    projects = [];
    activeProjectId = null;
    capturedContexts = [];
  }
}

async function saveProjects() {
  try {
    await chrome.storage.local.set({ projects, activeProjectId });
  } catch (error) {
    console.error('Error saving projects:', error);
    showToast('Error saving project', 'error');
  }
}

async function saveCapturedContexts() {
  try {
    await chrome.storage.local.set({ capturedContexts });
    updateCapturedBadge();
    
    // Sync to cloud if online
    if (isOnline && currentUser) {
      debouncedSync();
    }
  } catch (error) {
    console.error('Error saving contexts:', error);
  }
}

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

// ===== CLOUD SYNC =====

let syncTimeout = null;
function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncWithCloud, 5000);
}

async function syncWithCloud() {
  if (!currentUser || !isOnline) return;
  
  try {
    elements.syncStatusBtn?.classList.add('syncing');
    
    // Sync contexts to cloud
    const results = await window.API.syncContextsToCloud(currentUser.id, capturedContexts);
    
    // Update local contexts with cloud IDs
    for (const result of results) {
      if (result.cloudId) {
        const ctx = capturedContexts.find(c => c.id === result.id);
        if (ctx) ctx.cloudId = result.cloudId;
      }
    }
    
    await chrome.storage.local.set({ capturedContexts });
    lastSyncTime = Date.now();
    
    elements.syncStatusBtn?.classList.remove('syncing');
    elements.syncStatusBtn?.classList.add('synced');
    
    setTimeout(() => {
      elements.syncStatusBtn?.classList.remove('synced');
    }, 2000);
  } catch (error) {
    console.error('Sync error:', error);
    elements.syncStatusBtn?.classList.remove('syncing');
  }
}

// ===== OFFLINE STATUS & QUEUE =====
let syncProgress = { total: 0, completed: 0, current: null };

async function updateSyncStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
    isOnline = status?.isOnline ?? navigator.onLine;
    syncQueueLength = status?.queueLength ?? 0;
    
    // Update sync progress if available
    if (status?.syncProgress) {
      syncProgress = status.syncProgress;
      updateSyncProgressUI();
    }
    
    // Update UI
    if (elements.syncStatusBtn) {
      if (!isOnline) {
        elements.syncStatusBtn.classList.add('offline');
        elements.syncStatusBtn.title = 'Offline - changes queued';
      } else {
        elements.syncStatusBtn.classList.remove('offline');
        if (syncQueueLength > 0 || syncProgress.total > 0) {
          elements.syncStatusBtn.classList.add('has-queue');
          elements.syncStatusBtn.title = syncProgress.total > 0 
            ? `Syncing ${syncProgress.completed}/${syncProgress.total}...`
            : `${syncQueueLength} items queued for sync`;
        } else {
          elements.syncStatusBtn.classList.remove('has-queue');
          elements.syncStatusBtn.title = 'Synced';
        }
      }
    }
  } catch (e) {
    console.warn('Failed to get sync status:', e);
  }
}

function updateSyncProgressUI() {
  const progressBar = document.getElementById('syncProgressBar');
  const progressText = document.getElementById('syncProgressText');
  const progressContainer = document.getElementById('syncProgressContainer');
  
  if (!progressContainer) return;
  
  if (syncProgress.total > 0 && syncProgress.completed < syncProgress.total) {
    progressContainer.classList.remove('hidden');
    const percent = Math.round((syncProgress.completed / syncProgress.total) * 100);
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) {
      const currentItem = syncProgress.current ? `: ${syncProgress.current.substring(0, 25)}...` : '';
      progressText.textContent = `Syncing ${syncProgress.completed + 1}/${syncProgress.total}${currentItem}`;
    }
  } else if (syncProgress.total > 0 && syncProgress.completed === syncProgress.total) {
    // Completed
    progressContainer.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = `Synced ${syncProgress.total} items ✓`;
    setTimeout(() => {
      progressContainer.classList.add('hidden');
    }, 2000);
  } else {
    progressContainer.classList.add('hidden');
  }
}

// Listen for sync progress updates from background
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'SYNC_PROGRESS_UPDATE') {
    syncProgress = req.progress;
    syncQueueLength = req.progress.queueLength;
    updateSyncProgressUI();
    updateSyncStatus();
  }
});

async function forceSyncQueue() {
  if (!isOnline) {
    showToast('Currently offline', 'error');
    return;
  }
  
  try {
    showToast('Starting sync...', 'info');
    await chrome.runtime.sendMessage({ type: 'PROCESS_SYNC_QUEUE' });
    await updateSyncStatus();
  } catch (e) {
    showToast('Sync failed', 'error');
  }
}

// Update sync status periodically
setInterval(updateSyncStatus, 10000);

// Listen for online/offline events
window.addEventListener('online', () => {
  isOnline = true;
  updateSyncStatus();
  showToast('Back online!', 'success');
});

window.addEventListener('offline', () => {
  isOnline = false;
  updateSyncStatus();
  showToast('You are offline', 'info');
});

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
  const ctx = capturedContexts.find(c => c.id === id);
  
  // Delete from cloud if has cloudId
  if (ctx?.cloudId && currentUser) {
    window.API.deleteContext(ctx.cloudId).catch(console.error);
  }
  
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

// ===== TEAM FUNCTIONS =====

// Realtime subscription cleanup function
let unsubscribeRealtime = null;

async function updateTeamView() {
  if (!currentTeam) {
    elements.noTeamView?.classList.remove('hidden');
    elements.teamActiveView?.classList.add('hidden');
    elements.teamBadge?.classList.add('hidden');
    
    // Cleanup realtime subscription
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    return;
  }
  
  elements.noTeamView?.classList.add('hidden');
  elements.teamActiveView?.classList.remove('hidden');
  
  // Update team info
  elements.teamNameDisplay.textContent = currentTeam.name;
  
  // Load team members
  const members = await window.API.getTeamMembers(currentTeam.id);
  elements.teamMemberCount.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}`;
  
  // Load team contexts
  teamContexts = await window.API.getTeamContexts(currentTeam.id);
  renderTeamContexts();
  
  // Update badge
  updateTeamBadge();
  
  // Setup realtime subscription for instant team sync
  setupRealtimeSubscription();
}

function updateTeamBadge() {
  if (teamContexts.length > 0) {
    elements.teamBadge.textContent = teamContexts.length;
    elements.teamBadge.classList.remove('hidden');
  } else {
    elements.teamBadge.classList.add('hidden');
  }
}

function setupRealtimeSubscription() {
  if (!currentTeam || !window.API?.subscribeToTeamContexts) return;
  
  // Cleanup existing subscription
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
  }
  
  // Subscribe to team context changes
  unsubscribeRealtime = window.API.subscribeToTeamContexts(currentTeam.id, {
    onInsert: (newContext) => {
      console.log('Realtime: New context shared', newContext);
      // Add to teamContexts if not already present
      if (!teamContexts.find(c => c.id === newContext.id)) {
        teamContexts.unshift(newContext);
        renderTeamContexts();
        updateTeamBadge();
        showToast('New context shared to team!', 'info');
      }
    },
    onUpdate: (updatedContext) => {
      console.log('Realtime: Context updated', updatedContext);
      const idx = teamContexts.findIndex(c => c.id === updatedContext.id);
      if (idx !== -1) {
        teamContexts[idx] = updatedContext;
        renderTeamContexts();
      }
    },
    onDelete: (deletedContext) => {
      console.log('Realtime: Context deleted', deletedContext);
      teamContexts = teamContexts.filter(c => c.id !== deletedContext.id);
      renderTeamContexts();
      updateTeamBadge();
    }
  });
}

function renderTeamContexts() {
  if (!elements.teamContextsList) return;
  
  if (teamContexts.length === 0) {
    elements.teamContextsList.innerHTML = `
      <div class="empty-state-small">
        <p>No shared contexts yet. Share your captures with the team!</p>
      </div>
    `;
    return;
  }
  
  elements.teamContextsList.innerHTML = teamContexts.map(ctx => {
    const time = getRelativeTime(new Date(ctx.captured_at).getTime());
    const platformClass = (ctx.platform || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const authorName = ctx.extension_users?.name || 'Unknown';
    
    return `
      <div class="captured-card team-context" data-id="${ctx.id}">
        <div class="captured-header">
          <span class="platform-badge ${platformClass}">${ctx.platform || 'Unknown'}</span>
          <span class="captured-time">${time}</span>
        </div>
        <div class="captured-title">${escapeHtml(ctx.title || 'Untitled Chat')}</div>
        <div class="captured-summary">${escapeHtml(ctx.summary || 'No summary')}</div>
        <div class="captured-meta">
          <span class="meta-tag author">👤 ${escapeHtml(authorName)}</span>
        </div>
        <div class="captured-actions">
          <button class="use-btn" title="Use this context">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Use
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreateTeam() {
  elements.teamFormTitle.textContent = 'Create Team';
  elements.createTeamFields.classList.remove('hidden');
  elements.joinTeamFields.classList.add('hidden');
  elements.teamSubmitBtn.textContent = 'Create Team';
  elements.teamName.value = '';
  showView('teamForm');
}

async function handleJoinTeam() {
  elements.teamFormTitle.textContent = 'Join Team';
  elements.createTeamFields.classList.add('hidden');
  elements.joinTeamFields.classList.remove('hidden');
  elements.teamSubmitBtn.textContent = 'Join Team';
  elements.inviteCode.value = '';
  showView('teamForm');
}

async function handleTeamFormSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) return;
  
  const isCreate = !elements.createTeamFields.classList.contains('hidden');
  
  try {
    if (isCreate) {
      const name = elements.teamName.value.trim();
      if (!name) {
        showToast('Enter a team name', 'error');
        return;
      }
      
      showToast('Creating team...', 'info');
      currentTeam = await window.API.createTeam(name, currentUser.id);
      await chrome.storage.local.set({ teamId: currentTeam.id });
      showToast('Team created!', 'success');
    } else {
      const code = elements.inviteCode.value.trim();
      if (!code) {
        showToast('Enter an invite code', 'error');
        return;
      }
      
      showToast('Joining team...', 'info');
      currentTeam = await window.API.joinTeam(code, currentUser.id);
      await chrome.storage.local.set({ teamId: currentTeam.id });
      showToast('Joined team!', 'success');
    }
    
    updateTeamView();
    showView('team');
  } catch (error) {
    console.error('Team error:', error);
    showToast(error.message || 'Failed', 'error');
  }
}

async function handleShareInvite() {
  if (!currentTeam) return;
  
  const inviteCode = currentTeam.invite_code;
  await copyToClipboard(inviteCode);
  showToast('Invite code copied!', 'success');
}

async function handleLeaveTeam() {
  if (!currentTeam || !currentUser) return;
  
  if (!confirm('Leave this team?')) return;
  
  try {
    await window.API.leaveTeam(currentTeam.id, currentUser.id);
    currentTeam = null;
    await chrome.storage.local.remove('teamId');
    updateTeamView();
    showToast('Left team', 'success');
  } catch (error) {
    showToast('Failed to leave team', 'error');
  }
}

async function handleShareToTeam() {
  if (!currentTeam || !selectedContextId) {
    showToast('Join a team first', 'error');
    return;
  }
  
  const ctx = getCapturedContext(selectedContextId);
  if (!ctx) return;
  
  try {
    // Save to cloud with team_id
    await window.API.saveContext({
      user_id: currentUser.id,
      team_id: currentTeam.id,
      url: ctx.url,
      title: ctx.title,
      topic: ctx.topic,
      summary: ctx.summary,
      key_points: ctx.keyPoints || [],
      tech_stack: ctx.techStack || [],
      decisions: ctx.decisions || [],
      open_questions: ctx.openQuestions || [],
      raw_content: ctx.rawContent,
      message_count: ctx.messageCount?.user + ctx.messageCount?.ai || 0,
      platform: ctx.platform
    });
    
    showToast('Shared to team!', 'success');
    updateTeamView();
  } catch (error) {
    showToast('Failed to share', 'error');
  }
}

// ===== RENDER FUNCTIONS =====

function renderProjectList() {
  if (!elements.projectList) return;
  
  if (projects.length === 0) {
    elements.projectList.innerHTML = '';
    elements.emptyState?.classList.remove('hidden');
    elements.quickActions?.classList.add('hidden');
    return;
  }
  
  elements.emptyState?.classList.add('hidden');
  
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
  if (!elements.capturedList) return;
  
  if (capturedContexts.length === 0) {
    elements.capturedList.innerHTML = '';
    elements.capturedEmptyState?.classList.remove('hidden');
    return;
  }
  
  elements.capturedEmptyState?.classList.add('hidden');
  
  const sortedContexts = [...capturedContexts].sort((a, b) => b.timestamp - a.timestamp);
  
  elements.capturedList.innerHTML = sortedContexts.map(ctx => {
    const time = getRelativeTime(ctx.timestamp || new Date(ctx.capturedAt).getTime());
    const platformClass = (ctx.platform || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const techPreview = ctx.techStack?.length > 0 ? ctx.techStack.slice(0, 3).join(', ') : '';
    const keyPointsCount = ctx.keyPoints?.length || 0;
    const decisionsCount = ctx.decisions?.length || 0;
    const builtCount = ctx.whatHasBeenBuilt?.length || 0;
    const syncIcon = ctx.cloudId ? '☁️' : '💾';
    const aiIcon = ctx.aiAnalyzed ? '✨' : '';
    
    // Create a richer preview showing context depth
    const hasRichContext = ctx.projectOrigin || ctx.coreInsights || ctx.strategicDirection;
    const contextDepth = hasRichContext ? 'rich' : 'basic';
    
    return `
      <div class="captured-card ${contextDepth}" data-id="${ctx.id}">
        <div class="captured-header">
          <span class="platform-badge ${platformClass}">${ctx.platform}</span>
          <span class="captured-time">${syncIcon} ${aiIcon} ${time}</span>
        </div>
        <div class="captured-title">${escapeHtml(ctx.title || 'Untitled Chat')}</div>
        ${ctx.topic && ctx.topic !== ctx.title ? `<div class="captured-topic">🎯 ${escapeHtml(ctx.topic)}</div>` : ''}
        <div class="captured-summary">${escapeHtml(ctx.summary || 'No summary available')}</div>
        ${ctx.currentStatus ? `<div class="captured-status">📊 ${escapeHtml(ctx.currentStatus.substring(0, 100))}...</div>` : ''}
        <div class="captured-meta">
          ${techPreview ? `<span class="meta-tag tech">🛠️ ${techPreview}</span>` : ''}
          ${keyPointsCount ? `<span class="meta-tag points">💡 ${keyPointsCount}</span>` : ''}
          ${decisionsCount ? `<span class="meta-tag decisions">✅ ${decisionsCount}</span>` : ''}
          ${builtCount ? `<span class="meta-tag built">🏗️ ${builtCount}</span>` : ''}
        </div>
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
    elements.quickActions?.classList.remove('hidden');
  } else {
    elements.quickActions?.classList.add('hidden');
  }
}

// ===== VIEW FUNCTIONS =====

function showView(view) {
  currentView = view;
  
  // Hide all views
  const allViews = [
    elements.projectListView,
    elements.projectFormView,
    elements.captureView,
    elements.capturedView,
    elements.contextDetailView,
    elements.teamView,
    elements.teamFormView
  ];
  
  allViews.forEach(v => v?.classList.remove('active'));
  
  // Reset tab states
  elements.tabProjects?.classList.remove('active');
  elements.tabCaptured?.classList.remove('active');
  elements.tabTeam?.classList.remove('active');
  
  switch (view) {
    case 'list':
      elements.projectListView?.classList.add('active');
      elements.tabProjects?.classList.add('active');
      break;
    case 'captured':
      elements.capturedView?.classList.add('active');
      elements.tabCaptured?.classList.add('active');
      break;
    case 'team':
      elements.teamView?.classList.add('active');
      elements.tabTeam?.classList.add('active');
      updateTeamView();
      break;
    case 'teamForm':
      elements.teamFormView?.classList.add('active');
      elements.tabTeam?.classList.add('active');
      break;
    case 'form':
      elements.projectFormView?.classList.add('active');
      break;
    case 'capture':
      elements.captureView?.classList.add('active');
      break;
    case 'contextDetail':
      elements.contextDetailView?.classList.add('active');
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
  
  elements.capturedContent?.classList.add('hidden');
  if (elements.capturedText) elements.capturedText.value = '';
  showView('capture');
}

function showContextDetail(id, isTeamContext = false) {
  const ctx = isTeamContext 
    ? teamContexts.find(c => c.id === id)
    : getCapturedContext(id);
    
  if (!ctx) return;
  
  selectedContextId = id;
  elements.contextDetailTitle.textContent = ctx.title || 'Captured Context';
  elements.contextPlatform.textContent = ctx.platform;
  elements.contextPlatform.className = 'platform-badge ' + (ctx.platform || 'unknown').toLowerCase().replace(/\s+/g, '-');
  
  const timestamp = isTeamContext ? new Date(ctx.captured_at).getTime() : ctx.timestamp;
  elements.contextTime.textContent = getRelativeTime(timestamp);
  
  // Show author for team contexts
  if (isTeamContext && ctx.extension_users?.name) {
    elements.contextAuthor.textContent = `by ${ctx.extension_users.name}`;
    elements.contextAuthor.classList.remove('hidden');
  } else {
    elements.contextAuthor.classList.add('hidden');
  }
  
  // Show/hide share button based on team status
  if (currentTeam && !isTeamContext) {
    elements.shareToTeamBtn?.classList.remove('hidden');
  } else {
    elements.shareToTeamBtn?.classList.add('hidden');
  }
  
  // Build detailed content view - Enhanced with richer context
  let detailContent = '';
  
  // Extract fields (handle both local and team context formats)
  const summary = ctx.summary;
  const projectOrigin = ctx.projectOrigin || ctx.project_origin;
  const coreInsights = ctx.coreInsights || ctx.core_insights;
  const whatHasBeenBuilt = ctx.whatHasBeenBuilt || ctx.what_has_been_built || [];
  const keyPoints = isTeamContext ? ctx.key_points : ctx.keyPoints;
  const techStack = isTeamContext ? ctx.tech_stack : ctx.techStack;
  const decisions = ctx.decisions;
  const strategicDirection = ctx.strategicDirection || ctx.strategic_direction;
  const currentStatus = ctx.currentStatus || ctx.current_status;
  const openQuestions = isTeamContext ? ctx.open_questions : ctx.openQuestions;
  const continuationPrompt = ctx.continuationPrompt || ctx.continuation_prompt;
  const importantContext = ctx.importantContext || ctx.important_context;
  const rawContent = isTeamContext ? ctx.raw_content : ctx.rawContent;
  
  // Topic header
  if (ctx.topic) {
    detailContent += `🎯 TOPIC: ${ctx.topic}\n\n`;
  }
  
  // Project Origin / Purpose
  if (projectOrigin) {
    detailContent += `📌 PROJECT ORIGIN\n${projectOrigin}\n\n`;
  }
  
  // Core Insights / Key Reframings
  if (coreInsights) {
    detailContent += `💎 CORE INSIGHTS\n${coreInsights}\n\n`;
  }
  
  // Summary
  if (summary) {
    detailContent += `📋 SUMMARY\n${summary}\n\n`;
  }
  
  // What Has Been Built / Established
  if (whatHasBeenBuilt && whatHasBeenBuilt.length > 0) {
    detailContent += `🏗️ WHAT HAS BEEN BUILT\n`;
    whatHasBeenBuilt.forEach((item, i) => {
      detailContent += `${i + 1}. ${item}\n`;
    });
    detailContent += '\n';
  }
  
  // Key Points
  if (keyPoints && keyPoints.length > 0) {
    detailContent += `💡 KEY POINTS\n`;
    keyPoints.forEach((point, i) => {
      detailContent += `${i + 1}. ${point}\n`;
    });
    detailContent += '\n';
  }
  
  // Tech Stack
  if (techStack && techStack.length > 0) {
    detailContent += `🛠️ TECH STACK\n${techStack.join(', ')}\n\n`;
  }
  
  // Strategic Direction
  if (strategicDirection) {
    detailContent += `🧭 STRATEGIC DIRECTION\n${strategicDirection}\n\n`;
  }
  
  // Decisions Made
  if (decisions && decisions.length > 0) {
    detailContent += `✅ DECISIONS MADE\n`;
    decisions.forEach(d => {
      detailContent += `• ${d}\n`;
    });
    detailContent += '\n';
  }
  
  // Current Status
  if (currentStatus) {
    detailContent += `📊 CURRENT STATUS\n${currentStatus}\n\n`;
  }
  
  // Open Questions
  if (openQuestions && openQuestions.length > 0) {
    detailContent += `❓ OPEN QUESTIONS\n`;
    openQuestions.forEach(q => {
      detailContent += `• ${q}\n`;
    });
    detailContent += '\n';
  }
  
  // Important Context / Rules
  if (importantContext) {
    detailContent += `⚠️ IMPORTANT CONTEXT\n${importantContext}\n\n`;
  }
  
  // Continuation Prompt (How to continue)
  if (continuationPrompt) {
    detailContent += `🔄 HOW TO CONTINUE\n${continuationPrompt}\n\n`;
  }
  
  // Raw Conversation
  detailContent += `─────────────────────────────────────\n📜 RAW CONVERSATION\n─────────────────────────────────────\n`;
  detailContent += rawContent || ctx.content || 'No raw content available (stored in cloud)';
  
  elements.contextContent.value = detailContent;
  
  showView('contextDetail');
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
  // Tabs
  elements.tabProjects?.addEventListener('click', () => showView('list'));
  elements.tabCaptured?.addEventListener('click', () => {
    loadData().then(() => {
      renderCapturedList();
      showView('captured');
    });
  });
  elements.tabTeam?.addEventListener('click', () => showView('team'));
  
  // Team buttons
  elements.createTeamBtn?.addEventListener('click', handleCreateTeam);
  elements.joinTeamBtn?.addEventListener('click', handleJoinTeam);
  elements.teamFormBackBtn?.addEventListener('click', () => showView('team'));
  elements.teamCancelBtn?.addEventListener('click', () => showView('team'));
  elements.teamForm?.addEventListener('submit', handleTeamFormSubmit);
  elements.shareTeamBtn?.addEventListener('click', handleShareInvite);
  elements.leaveTeamBtn?.addEventListener('click', handleLeaveTeam);
  elements.shareToTeamBtn?.addEventListener('click', handleShareToTeam);
  
  // Team tabs
  elements.teamContextsTab?.addEventListener('click', () => {
    elements.teamContextsTab.classList.add('active');
    elements.teamSummaryTab?.classList.remove('active');
    elements.teamContextsList?.classList.remove('hidden');
    elements.teamSummariesList?.classList.add('hidden');
    elements.createSummaryBtn?.classList.add('hidden');
  });
  
  elements.teamSummaryTab?.addEventListener('click', () => {
    elements.teamSummaryTab.classList.add('active');
    elements.teamContextsTab?.classList.remove('active');
    elements.teamSummariesList?.classList.remove('hidden');
    elements.teamContextsList?.classList.add('hidden');
    elements.createSummaryBtn?.classList.remove('hidden');
  });
  
  // Add project buttons
  elements.addProjectBtn?.addEventListener('click', showNewProjectForm);
  elements.emptyAddBtn?.addEventListener('click', showNewProjectForm);
  
  // Back/Cancel buttons
  elements.backBtn?.addEventListener('click', () => showView('list'));
  elements.cancelBtn?.addEventListener('click', () => showView('list'));
  elements.captureBackBtn?.addEventListener('click', () => showView('list'));
  elements.contextBackBtn?.addEventListener('click', () => showView('captured'));
  
  // Form submission
  elements.projectForm?.addEventListener('submit', handleFormSubmit);
  
  // Project list interactions
  elements.projectList?.addEventListener('click', handleProjectListClick);
  
  // Captured list interactions
  elements.capturedList?.addEventListener('click', handleCapturedListClick);
  elements.teamContextsList?.addEventListener('click', handleTeamContextsClick);
  
  // Quick actions
  elements.injectBtn?.addEventListener('click', handleInject);
  elements.copyBtn?.addEventListener('click', handleCopy);
  elements.captureBtn?.addEventListener('click', showCaptureView);
  elements.recallV2Btn?.addEventListener('click', handleV2Recall);
  
  // Capture actions
  elements.captureSelection?.addEventListener('click', handleCaptureSelection);
  elements.captureConversation?.addEventListener('click', handleCaptureConversation);
  elements.saveCaptured?.addEventListener('click', handleSaveCaptured);
  
  // Context detail actions
  elements.injectContextBtn?.addEventListener('click', handleInjectContext);
  elements.copyContextBtn?.addEventListener('click', handleCopyContext);
  elements.deleteContextBtn?.addEventListener('click', handleDeleteContext);
  
  // Auto-capture toggle
  elements.autoCaptureToggle?.addEventListener('change', (e) => {
    saveSettings({ autoCapture: e.target.checked });
    showToast(e.target.checked ? 'Auto-capture enabled' : 'Auto-capture disabled');
  });

  // V2 Memory toggle (feature flag)
  elements.v2IngestToggle?.addEventListener('change', (e) => {
    saveSettings({ useV2Ingest: e.target.checked });
    showToast(e.target.checked ? 'V2 Memory ingest enabled (beta)' : 'V2 Memory ingest disabled');
  });
  
  // V2 Auth buttons
  elements.v2LoginBtn?.addEventListener('click', handleV2Login);
  elements.v2MigrateBtn?.addEventListener('click', handleV2Migrate);
  elements.v2RefreshBtn?.addEventListener('click', handleV2RefreshSession);
  
  // Refresh/Manual capture button
  elements.refreshCaptureBtn?.addEventListener('click', handleManualCapture);

  // Export last raw chat button
  elements.exportLastRawBtn?.addEventListener('click', handleExportLastRaw);
  
  // Sync button
  elements.syncStatusBtn?.addEventListener('click', syncWithCloud);
  
  // Keyboard shortcuts toggle
  elements.toggleShortcuts?.addEventListener('click', toggleShortcutsPanel);
  
  // Close shortcuts panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shortcuts-hint') && elements.shortcutsPanel) {
      elements.shortcutsPanel.classList.add('hidden');
    }
  });
  
  // Online/offline events
  window.addEventListener('online', () => {
    isOnline = true;
    syncWithCloud();
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

function toggleShortcutsPanel() {
  elements.shortcutsPanel?.classList.toggle('hidden');
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
  
  showContextDetail(id);
}

function handleTeamContextsClick(e) {
  const card = e.target.closest('.captured-card');
  if (!card) return;
  
  const id = card.dataset.id;
  
  if (e.target.closest('.use-btn')) {
    const ctx = teamContexts.find(c => c.id === id);
    if (ctx) {
      const prompt = formatTeamContext(ctx);
      injectOrCopy(prompt);
    }
    return;
  }
  
  showContextDetail(id, true);
}

function formatTeamContext(ctx) {
  let prompt = `Continue from this team context:\n\n`;
  prompt += `Platform: ${ctx.platform}\n`;
  prompt += `Topic: ${ctx.title}\n`;
  prompt += `Shared by: ${ctx.extension_users?.name || 'Team member'}\n\n`;
  
  if (ctx.summary) {
    prompt += `Summary: ${ctx.summary}\n\n`;
  }
  
  if (ctx.key_points && ctx.key_points.length > 0) {
    prompt += `Key Points:\n`;
    ctx.key_points.forEach((point, i) => {
      prompt += `${i + 1}. ${point}\n`;
    });
    prompt += '\n';
  }
  
  if (ctx.tech_stack && ctx.tech_stack.length > 0) {
    prompt += `Tech Stack: ${ctx.tech_stack.join(', ')}\n\n`;
  }
  
  prompt += `Do not re-explain basics. Continue from this context.`;
  
  return prompt;
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
  prompt += `Topic: ${ctx.topic || ctx.title}\n`;
  prompt += `Captured: ${new Date(ctx.timestamp || ctx.capturedAt).toLocaleString()}\n\n`;
  
  // Project Origin
  if (ctx.projectOrigin) {
    prompt += `📌 PROJECT ORIGIN\n${ctx.projectOrigin}\n\n`;
  }
  
  // Core Insights
  if (ctx.coreInsights) {
    prompt += `💎 CORE INSIGHTS\n${ctx.coreInsights}\n\n`;
  }
  
  // Summary
  if (ctx.summary) {
    prompt += `Summary: ${ctx.summary}\n\n`;
  }
  
  // What Has Been Built
  if (ctx.whatHasBeenBuilt && ctx.whatHasBeenBuilt.length > 0) {
    prompt += `What Has Been Built/Established:\n`;
    ctx.whatHasBeenBuilt.forEach((item, i) => {
      prompt += `${i + 1}. ${item}\n`;
    });
    prompt += '\n';
  }
  
  // Key Points
  if (ctx.keyPoints && ctx.keyPoints.length > 0) {
    prompt += `Key Points from Previous Discussion:\n`;
    ctx.keyPoints.forEach((point, i) => {
      prompt += `${i + 1}. ${point}\n`;
    });
    prompt += '\n';
  }
  
  // Tech Stack
  if (ctx.techStack && ctx.techStack.length > 0) {
    prompt += `Tech Stack: ${ctx.techStack.join(', ')}\n\n`;
  }
  
  // Strategic Direction
  if (ctx.strategicDirection) {
    prompt += `Strategic Direction: ${ctx.strategicDirection}\n\n`;
  }
  
  // Decisions Made
  if (ctx.decisions && ctx.decisions.length > 0) {
    prompt += `Decisions Made:\n`;
    ctx.decisions.forEach(d => {
      prompt += `• ${d}\n`;
    });
    prompt += '\n';
  }
  
  // Current Status
  if (ctx.currentStatus) {
    prompt += `Current Status: ${ctx.currentStatus}\n\n`;
  }
  
  // Open Questions
  if (ctx.openQuestions && ctx.openQuestions.length > 0) {
    prompt += `Open Questions to Address:\n`;
    ctx.openQuestions.forEach(q => {
      prompt += `• ${q}\n`;
    });
    prompt += '\n';
  }
  
  // Important Context
  if (ctx.importantContext) {
    prompt += `⚠️ Important Context/Rules: ${ctx.importantContext}\n\n`;
  }
  
  // Continuation prompt
  if (ctx.continuationPrompt) {
    prompt += `How to Continue: ${ctx.continuationPrompt}\n\n`;
  } else {
    prompt += `Do not re-explain basics or ask onboarding questions. Continue from where we left off.`;
  }
  
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
      context: prompt
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

async function handleExportLastRaw() {
  try {
    if (!capturedContexts || capturedContexts.length === 0) {
      showToast('No captured chats yet', 'error');
      return;
    }
    const sorted = [...capturedContexts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const last = sorted.find(c => c.rawContent && c.rawContent.trim().length > 0) || sorted[0];
    const raw = last.rawContent || last.content || '';
    if (!raw.trim()) {
      showToast('Last capture has no raw text (stored in cloud only)', 'error');
      return;
    }

    const platform = last.platform || 'unknown';
    const title = (last.title || 'chat').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    const ts = new Date(last.timestamp || Date.now()).toISOString().replace(/[:.]/g, '-');
    const header = `# ${last.title || 'Captured Chat'}\nPlatform: ${platform}\nURL: ${last.url || ''}\nCaptured: ${new Date(last.timestamp || Date.now()).toISOString()}\nMessages: ${last.messageCount || 'n/a'}\n\n---\n\n`;
    const fileText = header + raw;

    // Copy to clipboard
    let copied = false;
    try {
      await navigator.clipboard.writeText(fileText);
      copied = true;
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }

    // Trigger download as .txt
    const filename = `${platform}_${title}_${ts}.txt`;
    const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const clipMsg = copied ? '📋 Copied to clipboard' : '⚠️ Clipboard blocked';
    showToast(`✓ Downloaded ${filename} — ${clipMsg}`, copied ? 'success' : 'warning');
  } catch (e) {
    console.error('Export last raw failed:', e);
    showToast('Export failed: ' + e.message, 'error');
  }
}

async function handleManualCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.url) {
      showToast('No active tab', 'error');
      return;
    }
    
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
      
      const detailedContext = generateDetailedContextFromText(response.text, platform, tab.title);
      
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
      
      await loadData();
      capturedContexts = capturedContexts.filter(c => c.url !== tab.url);
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

function generateDetailedContextFromText(text, platform, title) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  const userMessages = [];
  const aiMessages = [];
  let currentSpeaker = null;
  let currentMessage = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
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
      if (line.length > 50) {
        currentSpeaker = 'ai';
        currentMessage = [line];
      } else {
        currentSpeaker = 'user';
        currentMessage = [line];
      }
    }
  }
  
  if (currentMessage.length > 0 && currentSpeaker) {
    if (currentSpeaker === 'user') userMessages.push(currentMessage.join('\n'));
    else aiMessages.push(currentMessage.join('\n'));
  }
  
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

// ===== V2 RECALL =====

/**
 * Attempt to fetch the web app's auth session token
 * Uses the API module's session detection
 */
async function fetchWebSession() {
  // Use the API's session detection which handles cookies and localStorage
  if (window.API?.detectV2Session) {
    try {
      const session = await window.API.detectV2Session();
      return session?.accessToken || null;
    } catch (e) {
      console.log('AI Context Bridge: session detection failed', e);
    }
  }
  return null;
}

/**
 * Handle V2 Recall button click
 * Calls recall-memory endpoint and injects the promptBlock into the current chat
 */
async function handleV2Recall() {
  const settings = (await chrome.storage.local.get('settings')).settings || {};
  
  if (!settings.useV2Ingest) {
    showToast('Enable V2 Memory toggle first', 'error');
    return;
  }
  
  showToast('Recalling memories...', 'info');
  
  try {
    // Get web session token
    const token = await fetchWebSession();
    if (!token) {
      showToast('Sign in to the web app first', 'error');
      return;
    }
    
    // Get active project (if any)
    const projectId = activeProjectId || null;
    
    // Call recall-memory API
    const result = await window.API.recallMemory(token, {
      query: '', // No filter, get recent memories
      projectId: projectId,
      limit: 10,
      recencyDays: 30
    });
    
    if (!result.success) {
      showToast(result.error || 'Recall failed', 'error');
      return;
    }
    
    if (result.count === 0) {
      showToast('No memories found. Capture some chats first!', 'info');
      return;
    }
    
    // Inject the promptBlock into the current chat
    await injectOrCopy(result.promptBlock);
    showToast(`Recalled ${result.count} memories!`, 'success');
    
  } catch (error) {
    console.error('V2 Recall error:', error);
    showToast(error.message || 'Recall failed', 'error');
  }
}