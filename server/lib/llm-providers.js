/**
 * Multi-provider LLM abstraction
 * Supports OpenAI, Anthropic, and Google (Gemini)
 * Includes dynamic model fetching from provider APIs
 */

// Static fallback configs (used when API fetch fails)
const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    keyPrefix: 'sk-',
    models: [
      { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', default: true },
      { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano' },
      { id: 'o4-mini-2025-04-16', name: 'o4-mini' },
      { id: 'o3-mini-2025-01-31', name: 'o3-mini' },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    keyPrefix: 'sk-ant-',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5' },
    ],
  },
  google: {
    name: 'Google Gemini',
    keyPrefix: 'AIza',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
  },
};

// Cache for fetched models: { provider -> { models, fetchedAt } }
const modelCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch available models from a provider's API using the user's key.
 * Returns an array of { id, name, context_window?, created? }
 */
async function fetchProviderModels(provider, apiKey) {
  // Check cache first
  const cached = modelCache.get(`${provider}:${apiKey.slice(-6)}`);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.models;
  }

  let models = [];

  try {
    switch (provider) {
      case 'openai':
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'anthropic':
        models = await fetchAnthropicModels(apiKey);
        break;
      case 'google':
        models = await fetchGoogleModels(apiKey);
        break;
    }
  } catch (err) {
    console.warn(`[LLM] Failed to fetch ${provider} models:`, err.message);
    // Return static fallback
    return PROVIDER_CONFIGS[provider]?.models || [];
  }

  if (models.length > 0) {
    modelCache.set(`${provider}:${apiKey.slice(-6)}`, { models, fetchedAt: Date.now() });
  }
  return models.length > 0 ? models : (PROVIDER_CONFIGS[provider]?.models || []);
}

async function fetchOpenAIModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`OpenAI API ${response.status}`);
  const result = await response.json();
  const chatModels = (result.data || [])
    .filter(m => {
      const id = m.id;
      // Filter to chat-capable models
      return (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4'))
        && !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio')
        && !id.includes('search') && !id.includes('tts') && !id.includes('dall-e')
        && !id.includes('whisper') && !id.includes('embedding');
    })
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 15)
    .map(m => ({
      id: m.id,
      name: formatModelName(m.id),
      created: m.created,
      owned_by: m.owned_by,
    }));

  // Mark default
  const defaultId = chatModels.find(m => m.id.includes('gpt-5-mini'))?.id
    || chatModels.find(m => m.id.includes('gpt-4o') && !m.id.includes('mini'))?.id
    || chatModels[0]?.id;
  return chatModels.map(m => ({ ...m, default: m.id === defaultId }));
}

async function fetchAnthropicModels(apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!response.ok) throw new Error(`Anthropic API ${response.status}`);
  const result = await response.json();
  const models = (result.data || [])
    .filter(m => m.type === 'model')
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 15)
    .map(m => ({
      id: m.id,
      name: m.display_name || formatModelName(m.id),
      created: m.created_at,
    }));

  // Mark default
  const defaultId = models.find(m => m.id.includes('sonnet-4'))?.id
    || models.find(m => m.id.includes('sonnet'))?.id
    || models[0]?.id;
  return models.map(m => ({ ...m, default: m.id === defaultId }));
}

async function fetchGoogleModels(apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!response.ok) throw new Error(`Google API ${response.status}`);
  const result = await response.json();
  const models = (result.models || [])
    .filter(m => {
      const name = m.name || '';
      // Only generateContent-capable models (chat models)
      const methods = m.supportedGenerationMethods || [];
      return methods.includes('generateContent')
        && (name.includes('gemini'))
        && !name.includes('embedding') && !name.includes('aqa');
    })
    .map(m => {
      const id = (m.name || '').replace('models/', '');
      return {
        id,
        name: m.displayName || formatModelName(id),
        context_window: m.inputTokenLimit,
        output_limit: m.outputTokenLimit,
      };
    })
    .slice(0, 15);

  // Mark default
  const defaultId = models.find(m => m.id.includes('gemini-2.5-flash'))?.id
    || models.find(m => m.id.includes('gemini-2'))?.id
    || models[0]?.id;
  return models.map(m => ({ ...m, default: m.id === defaultId }));
}

function formatModelName(id) {
  return id
    .replace(/-(\d{4})(\d{2})(\d{2})$/, ' ($1-$2-$3)')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Call an LLM provider with a unified interface
 */
async function callLLMProvider(provider, apiKey, model, messages, options = {}) {
  const maxTokens = options.maxTokens || 4096;

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, messages, maxTokens);
    case 'anthropic':
      return callAnthropic(apiKey, model, messages, maxTokens);
    case 'google':
      return callGoogle(apiKey, model, messages, maxTokens);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function callOpenAI(apiKey, model, messages, maxTokens) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens }),
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  const usage = result.usage || {};
  return {
    text: result.choices?.[0]?.message?.content || '',
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    model,
  };
}

async function callAnthropic(apiKey, model, messages, maxTokens) {
  let systemPrompt = '';
  const filteredMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
    } else {
      filteredMessages.push(msg);
    }
  }

  const body = { model, max_tokens: maxTokens, messages: filteredMessages };
  if (systemPrompt) body.system = systemPrompt;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  const text = (result.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return {
    text,
    inputTokens: result.usage?.input_tokens || 0,
    outputTokens: result.usage?.output_tokens || 0,
    model,
  };
}

async function callGoogle(apiKey, model, messages, maxTokens) {
  let systemInstruction = '';
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);

  // Check for blocked/empty responses (Gemini safety filters)
  const candidate = result.candidates?.[0];
  if (!candidate || !candidate.content) {
    const blockReason = result.promptFeedback?.blockReason
      || candidate?.finishReason
      || 'unknown';
    throw new Error(`Gemini returned empty response (reason: ${blockReason})`);
  }

  const text = candidate.content.parts?.map(p => p.text).join('') || '';
  if (!text && candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini response blocked (finishReason: ${candidate.finishReason})`);
  }

  const usageMeta = result.usageMetadata || {};
  return {
    text,
    inputTokens: usageMeta.promptTokenCount || 0,
    outputTokens: usageMeta.candidatesTokenCount || 0,
    model,
  };
}

/**
 * Convert messages from OpenAI format (canonical) to a provider-specific format.
 * Handles system prompt extraction, role mapping, and image part conversion.
 */
function convertMessagesForProvider(provider, messages) {
  if (provider === 'openai') return { messages };

  if (provider === 'anthropic') {
    let systemPrompt = '';
    const converted = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + (typeof msg.content === 'string' ? msg.content : msg.content.map(p => p.text || '').join(''));
      } else {
        // Convert content parts for vision
        let content;
        if (Array.isArray(msg.content)) {
          content = msg.content.map(part => {
            if (part.type === 'text') return part;
            if (part.type === 'image_url' && part.image_url?.url) {
              const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
              }
            }
            return part;
          });
        } else {
          content = msg.content;
        }
        converted.push({ role: msg.role, content });
      }
    }
    return { system: systemPrompt || undefined, messages: converted };
  }

  if (provider === 'google') {
    let systemInstruction = '';
    const contents = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += (systemInstruction ? '\n\n' : '') + (typeof msg.content === 'string' ? msg.content : msg.content.map(p => p.text || '').join(''));
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let parts;
        if (Array.isArray(msg.content)) {
          parts = msg.content.map(part => {
            if (part.type === 'text') return { text: part.text };
            if (part.type === 'image_url' && part.image_url?.url) {
              const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                return { inlineData: { mimeType: match[1], data: match[2] } };
              }
            }
            return { text: part.text || '' };
          });
        } else {
          parts = [{ text: msg.content }];
        }
        contents.push({ role, parts });
      }
    }
    return { systemInstruction: systemInstruction || undefined, contents };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Prepare a streaming request for any provider.
 * Returns { url, headers, body } ready for fetch().
 * Input messages should be in OpenAI format (canonical).
 */
function prepareStreamRequest(provider, apiKey, model, messages, options = {}) {
  const maxTokens = options.maxTokens || 4096;

  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: maxTokens,
        stream: true,
      }),
    };
  }

  if (provider === 'anthropic') {
    const { system, messages: converted } = convertMessagesForProvider('anthropic', messages);
    const body = { model, max_tokens: maxTokens, messages: converted, stream: true };
    if (system) body.system = system;
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    };
  }

  if (provider === 'google') {
    const { systemInstruction, contents } = convertMessagesForProvider('google', messages);
    const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Parse a single SSE data line from a provider's stream.
 * Returns text delta string or null if the line has no content.
 */
function parseProviderSSELine(provider, rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed || !trimmed.startsWith('data: ')) return null;
  const payload = trimmed.slice(6);
  if (payload === '[DONE]') return null;

  try {
    const json = JSON.parse(payload);

    if (provider === 'openai') {
      return json.choices?.[0]?.delta?.content || null;
    }

    if (provider === 'anthropic') {
      if (json.type === 'content_block_delta') {
        return json.delta?.text || null;
      }
      return null;
    }

    if (provider === 'google') {
      return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Test an API key by making a minimal request
 */
async function testProviderKey(provider, apiKey, model) {
  const testMessages = [
    { role: 'user', content: 'Reply with exactly: OK' },
  ];
  const result = await callLLMProvider(provider, apiKey, model, testMessages, { maxTokens: 10 });
  return { success: true, response: result.text.slice(0, 50), model: result.model };
}

module.exports = {
  callLLMProvider, testProviderKey, fetchProviderModels, PROVIDER_CONFIGS,
  prepareStreamRequest, parseProviderSSELine, convertMessagesForProvider,
};
