/**
 * Multi-provider LLM abstraction
 * Supports OpenAI, Anthropic, and Google (Gemini)
 */

const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', default: true },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    keyPrefix: 'sk-',
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    ],
    keyPrefix: 'sk-ant-',
  },
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    keyPrefix: 'AIza',
  },
};

/**
 * Call an LLM provider with a unified interface
 * @param {string} provider - 'openai' | 'anthropic' | 'google'
 * @param {string} apiKey - Decrypted API key
 * @param {string} model - Model ID
 * @param {Array} messages - [{role, content}] in OpenAI format
 * @param {Object} options - { maxTokens }
 * @returns {{ text: string, inputTokens: number, outputTokens: number, model: string }}
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
  // Anthropic requires system message separate from messages array
  let systemPrompt = '';
  const filteredMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
    } else {
      filteredMessages.push(msg);
    }
  }

  const body = {
    model,
    max_tokens: maxTokens,
    messages: filteredMessages,
  };
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
  // Convert OpenAI format to Gemini format
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

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
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
  const text = result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const usageMeta = result.usageMetadata || {};
  return {
    text,
    inputTokens: usageMeta.promptTokenCount || 0,
    outputTokens: usageMeta.candidatesTokenCount || 0,
    model,
  };
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

module.exports = { callLLMProvider, testProviderKey, PROVIDER_CONFIGS };
