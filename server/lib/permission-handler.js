/**
 * Permission Request Handler
 *
 * Bridges MCP permission server HTTP calls with Socket.IO frontend events.
 *
 * Flow:
 * 1. MCP permission server POSTs to /api/internal/permission-request
 * 2. This module emits 'chat-permission-request' to the frontend socket
 * 3. User approves/rejects in the UI
 * 4. Frontend emits 'chat-permission-response' via socket
 * 5. This module resolves the pending HTTP request
 * 6. MCP server receives the response and returns to Claude CLI
 */

const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Map of chatId -> { socket, pendingRequests: Map<requestId, {resolve, reject, timer}> }
const chatSessions = new Map();

/**
 * Register a chat session for permission handling.
 * Called when a chat-send starts.
 */
function registerChatSession(chatId, socket) {
  chatSessions.set(chatId, {
    socket,
    pendingRequests: new Map(),
  });
}

/**
 * Unregister a chat session.
 * Called when chat-done or socket disconnects.
 */
function unregisterChatSession(chatId) {
  const session = chatSessions.get(chatId);
  if (session) {
    // Reject all pending requests
    for (const [reqId, pending] of session.pendingRequests) {
      clearTimeout(pending.timer);
      pending.resolve({ behavior: 'deny', message: 'Chat session ended' });
    }
    session.pendingRequests.clear();
    chatSessions.delete(chatId);
  }
}

/**
 * Handle a permission request from the MCP server (HTTP endpoint).
 * Returns a Promise that resolves when the user responds.
 */
function handlePermissionRequest(chatId, toolName, toolInput) {
  return new Promise((resolve) => {
    const session = chatSessions.get(chatId);
    if (!session || !session.socket) {
      console.warn(`[Permission] No active session for chatId: ${chatId}`);
      resolve({ behavior: 'deny', message: 'No active chat session' });
      return;
    }

    const requestId = `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Timeout: auto-deny after 5 minutes
    const timer = setTimeout(() => {
      session.pendingRequests.delete(requestId);
      console.warn(`[Permission] Request ${requestId} timed out for tool: ${toolName}`);
      resolve({ behavior: 'deny', message: 'Permission request timed out' });
    }, PERMISSION_TIMEOUT_MS);

    // Store the pending request
    session.pendingRequests.set(requestId, { resolve, timer });

    // Build a human-readable summary of the tool input
    const inputSummary = buildInputSummary(toolName, toolInput);

    // Emit to frontend
    console.log(`[Permission] Emitting request ${requestId} for tool: ${toolName}`);
    session.socket.emit('chat-permission-request', {
      requestId,
      toolName,
      toolInput,
      inputSummary,
      timestamp: Date.now(),
    });
  });
}

/**
 * Handle user's permission response from the frontend (socket event).
 */
function handlePermissionResponse(chatId, requestId, approved, updatedInput) {
  const session = chatSessions.get(chatId);
  if (!session) {
    console.warn(`[Permission] No session for chatId: ${chatId} (response for ${requestId})`);
    return false;
  }

  const pending = session.pendingRequests.get(requestId);
  if (!pending) {
    console.warn(`[Permission] No pending request: ${requestId}`);
    return false;
  }

  clearTimeout(pending.timer);
  session.pendingRequests.delete(requestId);

  if (approved) {
    console.log(`[Permission] Approved: ${requestId}`);
    const result = { behavior: 'allow' };
    if (updatedInput) result.updatedInput = updatedInput;
    pending.resolve(result);
  } else {
    console.log(`[Permission] Denied: ${requestId}`);
    pending.resolve({ behavior: 'deny', message: 'User denied permission' });
  }

  return true;
}

/**
 * Build a human-readable summary of tool input for the frontend.
 */
function buildInputSummary(toolName, input) {
  if (!input) return '';

  const name = toolName.toLowerCase();

  // File operations
  if (name === 'read' || name === 'write' || name === 'edit') {
    return input.file_path || input.path || '';
  }

  // Bash
  if (name === 'bash' || name.includes('bash')) {
    return input.command || '';
  }

  // Web
  if (name === 'webfetch' || name === 'websearch') {
    return input.url || input.query || '';
  }

  // Task / sub-agent
  if (name === 'task') {
    return `${input.subagent_type || ''}: ${input.description || input.prompt?.slice(0, 100) || ''}`;
  }

  // MCP tools
  if (name.startsWith('mcp__')) {
    return JSON.stringify(input).slice(0, 200);
  }

  // Glob/Grep
  if (name === 'glob') return input.pattern || '';
  if (name === 'grep') return input.pattern || '';

  // Default: first string value
  const firstStr = Object.values(input).find(v => typeof v === 'string');
  return firstStr?.slice(0, 200) || JSON.stringify(input).slice(0, 200);
}

/**
 * Express route handler for POST /api/internal/permission-request
 */
function permissionRequestRoute(req, res) {
  const { chatId, toolName, toolInput } = req.body;

  if (!chatId || !toolName) {
    return res.status(400).json({ error: 'Missing chatId or toolName' });
  }

  handlePermissionRequest(chatId, toolName, toolInput)
    .then(result => res.json(result))
    .catch(err => {
      console.error('[Permission] Route error:', err.message);
      res.json({ behavior: 'deny', message: err.message });
    });
}

module.exports = {
  registerChatSession,
  unregisterChatSession,
  handlePermissionResponse,
  permissionRequestRoute,
};
