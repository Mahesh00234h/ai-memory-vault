/**
 * AI Context Bridge - API Module
 * Handles all communication with Lovable Cloud backend
 * Includes Realtime subscriptions for team sync
 */

const SUPABASE_URL = 'https://meqqbjhfmrpsiqsexcif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcXFiamhmbXJwc2lxc2V4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDkzNzUsImV4cCI6MjA4Mzk4NTM3NX0.pqoNxaO0CtEFpGSYOZ3JZk7S3B1EOEYuh9mymP1mDqI';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

// ===== REALTIME STATE =====
let realtimeSocket = null;
let realtimeChannel = null;
let realtimeCallbacks = {
  onInsert: null,
  onUpdate: null,
  onDelete: null
};

// ===== USER API =====

async function createUser(name) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/extension_users`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) throw new Error('Failed to create user');
  const users = await response.json();
  return users[0];
}

async function getUser(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/extension_users?id=eq.${userId}`, {
    headers
  });
  
  if (!response.ok) return null;
  const users = await response.json();
  return users[0] || null;
}

// ===== TEAM API =====

async function createTeam(name, userId) {
  // Create team
  const teamResponse = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ name, created_by: userId })
  });
  
  if (!teamResponse.ok) throw new Error('Failed to create team');
  const teams = await teamResponse.json();
  const team = teams[0];
  
  // Add creator as member
  await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ team_id: team.id, user_id: userId })
  });
  
  return team;
}

async function joinTeam(inviteCode, userId) {
  // Find team by invite code
  const teamResponse = await fetch(`${SUPABASE_URL}/rest/v1/teams?invite_code=eq.${inviteCode}`, {
    headers
  });
  
  if (!teamResponse.ok) throw new Error('Failed to find team');
  const teams = await teamResponse.json();
  
  if (teams.length === 0) throw new Error('Invalid invite code');
  const team = teams[0];
  
  // Check if already a member
  const memberCheck = await fetch(
    `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${team.id}&user_id=eq.${userId}`,
    { headers }
  );
  const existingMembers = await memberCheck.json();
  
  if (existingMembers.length > 0) {
    return team; // Already a member
  }
  
  // Add as member
  await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ team_id: team.id, user_id: userId })
  });
  
  return team;
}

async function leaveTeam(teamId, userId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${teamId}&user_id=eq.${userId}`,
    { method: 'DELETE', headers }
  );
  return response.ok;
}

async function getTeamMembers(teamId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/team_members?team_id=eq.${teamId}&select=*,extension_users(*)`,
    { headers }
  );
  
  if (!response.ok) return [];
  return await response.json();
}

async function getUserTeams(userId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/team_members?user_id=eq.${userId}&select=*,teams(*)`,
    { headers }
  );
  
  if (!response.ok) return [];
  const memberships = await response.json();
  return memberships.map(m => m.teams).filter(Boolean);
}

// ===== CONTEXT API =====

async function saveContext(context) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/captured_contexts`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(context)
  });
  
  if (!response.ok) throw new Error('Failed to save context');
  const contexts = await response.json();
  return contexts[0];
}

async function updateContext(contextId, updates) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${contextId}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(updates)
    }
  );
  
  if (!response.ok) throw new Error('Failed to update context');
  const contexts = await response.json();
  return contexts[0];
}

async function deleteContext(contextId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${contextId}`,
    { method: 'DELETE', headers }
  );
  return response.ok;
}

async function getUserContexts(userId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/captured_contexts?user_id=eq.${userId}&team_id=is.null&order=captured_at.desc`,
    { headers }
  );
  
  if (!response.ok) return [];
  return await response.json();
}

async function getTeamContexts(teamId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/captured_contexts?team_id=eq.${teamId}&order=captured_at.desc&select=*,extension_users(name)`,
    { headers }
  );
  
  if (!response.ok) return [];
  return await response.json();
}

async function shareContextToTeam(contextId, teamId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/captured_contexts?id=eq.${contextId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ team_id: teamId })
    }
  );
  return response.ok;
}

// ===== TEAM SUMMARY API =====

async function createTeamSummary(summary) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/team_summaries`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(summary)
  });
  
  if (!response.ok) throw new Error('Failed to create summary');
  const summaries = await response.json();
  return summaries[0];
}

async function getTeamSummaries(teamId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/team_summaries?team_id=eq.${teamId}&order=created_at.desc&select=*,extension_users(name)`,
    { headers }
  );
  
  if (!response.ok) return [];
  return await response.json();
}

// ===== SYNC FUNCTIONS =====

async function syncContextsToCloud(userId, localContexts) {
  const results = [];
  
  for (const local of localContexts) {
    if (local.cloudId) {
      // Update existing - only send raw content to cloud
      try {
        await updateContext(local.cloudId, {
          title: local.title,
          topic: local.topic,
          summary: local.summary,
          key_points: local.keyPoints || [],
          tech_stack: local.techStack || [],
          decisions: local.decisions || [],
          open_questions: local.openQuestions || [],
          raw_content: local.rawContent,
          message_count: typeof local.messageCount === 'number' ? local.messageCount : (local.messageCount?.user + local.messageCount?.ai || 0),
          platform: local.platform
        });
        results.push({ id: local.id, synced: true });
      } catch (e) {
        results.push({ id: local.id, synced: false, error: e.message });
      }
    } else {
      // Create new - save full context including raw content to cloud
      try {
        const cloud = await saveContext({
          user_id: userId,
          url: local.url,
          title: local.title,
          topic: local.topic,
          summary: local.summary,
          key_points: local.keyPoints || [],
          tech_stack: local.techStack || [],
          decisions: local.decisions || [],
          open_questions: local.openQuestions || [],
          raw_content: local.rawContent,
          message_count: typeof local.messageCount === 'number' ? local.messageCount : (local.messageCount?.user + local.messageCount?.ai || 0),
          platform: local.platform
        });
        results.push({ id: local.id, cloudId: cloud.id, synced: true });
      } catch (e) {
        results.push({ id: local.id, synced: false, error: e.message });
      }
    }
  }
  
  return results;
}

async function fetchCloudContexts(userId) {
  return await getUserContexts(userId);
}

// ===== REALTIME SUBSCRIPTIONS =====

function subscribeToTeamContexts(teamId, callbacks) {
  // Store callbacks for handling events
  realtimeCallbacks = { ...realtimeCallbacks, ...callbacks };
  
  // Create WebSocket connection to Supabase Realtime
  const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_ANON_KEY + '&vsn=1.0.0';
  
  if (realtimeSocket) {
    realtimeSocket.close();
  }
  
  realtimeSocket = new WebSocket(wsUrl);
  
  realtimeSocket.onopen = () => {
    console.log('Realtime connected');
    
    // Join the channel for team contexts
    const joinMessage = {
      topic: `realtime:public:captured_contexts:team_id=eq.${teamId}`,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          postgres_changes: [
            {
              event: '*',
              schema: 'public',
              table: 'captured_contexts',
              filter: `team_id=eq.${teamId}`
            }
          ]
        }
      },
      ref: '1'
    };
    
    realtimeSocket.send(JSON.stringify(joinMessage));
    
    // Start heartbeat
    setInterval(() => {
      if (realtimeSocket?.readyState === WebSocket.OPEN) {
        realtimeSocket.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: Date.now().toString()
        }));
      }
    }, 30000);
  };
  
  realtimeSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.event === 'postgres_changes') {
        const payload = message.payload;
        
        if (payload.eventType === 'INSERT' && realtimeCallbacks.onInsert) {
          realtimeCallbacks.onInsert(payload.new);
        } else if (payload.eventType === 'UPDATE' && realtimeCallbacks.onUpdate) {
          realtimeCallbacks.onUpdate(payload.new);
        } else if (payload.eventType === 'DELETE' && realtimeCallbacks.onDelete) {
          realtimeCallbacks.onDelete(payload.old);
        }
      }
    } catch (e) {
      console.error('Realtime message error:', e);
    }
  };
  
  realtimeSocket.onerror = (error) => {
    console.error('Realtime error:', error);
  };
  
  realtimeSocket.onclose = () => {
    console.log('Realtime disconnected');
  };
  
  return () => {
    if (realtimeSocket) {
      realtimeSocket.close();
      realtimeSocket = null;
    }
  };
}

function unsubscribeFromRealtime() {
  if (realtimeSocket) {
    realtimeSocket.close();
    realtimeSocket = null;
  }
  realtimeCallbacks = { onInsert: null, onUpdate: null, onDelete: null };
}

// Export for use in popup.js
if (typeof window !== 'undefined') {
  window.API = {
    createUser,
    getUser,
    createTeam,
    joinTeam,
    leaveTeam,
    getTeamMembers,
    getUserTeams,
    saveContext,
    updateContext,
    deleteContext,
    getUserContexts,
    getTeamContexts,
    shareContextToTeam,
    createTeamSummary,
    getTeamSummaries,
    syncContextsToCloud,
    fetchCloudContexts,
    subscribeToTeamContexts,
    unsubscribeFromRealtime
  };
}