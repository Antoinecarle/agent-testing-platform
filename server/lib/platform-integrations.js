/**
 * Platform Integrations — Server-side API clients for external platforms.
 *
 * Each platform has:
 *   - An API client that makes authenticated requests
 *   - Action handlers that map action names to API calls
 *   - Response formatters that structure data for LLM context injection
 *
 * Credentials are encrypted at rest using the same AES-256-GCM as LLM keys.
 * Decryption happens only when executing an action.
 */

const { encryptApiKey, decryptApiKey } = require('./key-encryption');

// =================== NOTION API CLIENT ===================

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

async function notionRequest(token, endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${NOTION_BASE_URL}${endpoint}`, opts);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Notion API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Extract readable text from Notion rich_text array.
 */
function richTextToPlain(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(rt => rt.plain_text || '').join('');
}

/**
 * Convert Notion blocks to readable markdown-like text.
 */
function blocksToText(blocks) {
  if (!blocks || !Array.isArray(blocks)) return '';
  const lines = [];
  for (const block of blocks) {
    const type = block.type;
    if (!type || !block[type]) continue;

    const content = block[type];
    switch (type) {
      case 'paragraph':
        lines.push(richTextToPlain(content.rich_text));
        break;
      case 'heading_1':
        lines.push(`# ${richTextToPlain(content.rich_text)}`);
        break;
      case 'heading_2':
        lines.push(`## ${richTextToPlain(content.rich_text)}`);
        break;
      case 'heading_3':
        lines.push(`### ${richTextToPlain(content.rich_text)}`);
        break;
      case 'bulleted_list_item':
        lines.push(`- ${richTextToPlain(content.rich_text)}`);
        break;
      case 'numbered_list_item':
        lines.push(`1. ${richTextToPlain(content.rich_text)}`);
        break;
      case 'to_do': {
        const check = content.checked ? '[x]' : '[ ]';
        lines.push(`${check} ${richTextToPlain(content.rich_text)}`);
        break;
      }
      case 'toggle':
        lines.push(`> ${richTextToPlain(content.rich_text)}`);
        break;
      case 'quote':
        lines.push(`> ${richTextToPlain(content.rich_text)}`);
        break;
      case 'callout': {
        const emoji = content.icon?.emoji || '';
        lines.push(`${emoji} ${richTextToPlain(content.rich_text)}`);
        break;
      }
      case 'code': {
        const lang = content.language || '';
        lines.push(`\`\`\`${lang}\n${richTextToPlain(content.rich_text)}\n\`\`\``);
        break;
      }
      case 'divider':
        lines.push('---');
        break;
      case 'table_row': {
        if (content.cells) {
          const row = content.cells.map(cell => richTextToPlain(cell)).join(' | ');
          lines.push(`| ${row} |`);
        }
        break;
      }
      case 'image': {
        const url = content.file?.url || content.external?.url || '';
        lines.push(`![image](${url})`);
        break;
      }
      case 'bookmark':
        lines.push(`[Bookmark: ${content.url || ''}]`);
        break;
      default:
        // Try to extract any rich_text
        if (content.rich_text) {
          lines.push(richTextToPlain(content.rich_text));
        }
    }
  }
  return lines.join('\n');
}

/**
 * Format Notion page properties into readable key-value pairs.
 */
function formatProperties(properties) {
  if (!properties) return '';
  const lines = [];
  for (const [key, prop] of Object.entries(properties)) {
    let value = '';
    switch (prop.type) {
      case 'title':
        value = richTextToPlain(prop.title);
        break;
      case 'rich_text':
        value = richTextToPlain(prop.rich_text);
        break;
      case 'number':
        value = prop.number != null ? String(prop.number) : '';
        break;
      case 'select':
        value = prop.select?.name || '';
        break;
      case 'multi_select':
        value = (prop.multi_select || []).map(s => s.name).join(', ');
        break;
      case 'date':
        value = prop.date?.start || '';
        if (prop.date?.end) value += ` to ${prop.date.end}`;
        break;
      case 'checkbox':
        value = prop.checkbox ? 'Yes' : 'No';
        break;
      case 'url':
        value = prop.url || '';
        break;
      case 'email':
        value = prop.email || '';
        break;
      case 'phone_number':
        value = prop.phone_number || '';
        break;
      case 'status':
        value = prop.status?.name || '';
        break;
      case 'people':
        value = (prop.people || []).map(p => p.name || p.id).join(', ');
        break;
      case 'relation':
        value = `${(prop.relation || []).length} related items`;
        break;
      case 'formula':
        value = prop.formula?.string || prop.formula?.number?.toString() || '';
        break;
      case 'rollup':
        value = prop.rollup?.number?.toString() || `${(prop.rollup?.array || []).length} items`;
        break;
      case 'created_time':
        value = prop.created_time || '';
        break;
      case 'last_edited_time':
        value = prop.last_edited_time || '';
        break;
      default:
        value = JSON.stringify(prop[prop.type] || '').slice(0, 100);
    }
    if (value) lines.push(`**${key}:** ${value}`);
  }
  return lines.join('\n');
}

// Notion IDs are UUIDs (with or without dashes)
const NOTION_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function validateNotionId(id, label) {
  if (!id) throw new Error(`${label} is required`);
  if (!NOTION_ID_RE.test(id)) throw new Error(`Invalid ${label} format (expected UUID)`);
}

// =================== NOTION ACTIONS ===================

const NOTION_ACTIONS = {
  /**
   * Search across the Notion workspace.
   */
  search: async (token, params) => {
    const body = {
      query: params.query || '',
      page_size: Math.min(params.limit || 10, 20),
    };
    if (params.filter_type === 'page' || params.filter_type === 'database') {
      body.filter = { property: 'object', value: params.filter_type };
    }
    if (params.sort_direction) {
      body.sort = { direction: params.sort_direction, timestamp: 'last_edited_time' };
    }

    const result = await notionRequest(token, '/search', 'POST', body);

    const items = (result.results || []).map(item => {
      const isPage = item.object === 'page';
      const isDb = item.object === 'database';
      let title = '';

      if (isDb) {
        title = richTextToPlain(item.title);
      } else if (isPage && item.properties) {
        // Find the title property
        for (const prop of Object.values(item.properties)) {
          if (prop.type === 'title') {
            title = richTextToPlain(prop.title);
            break;
          }
        }
      }

      return {
        id: item.id,
        type: item.object,
        title: title || '(untitled)',
        url: item.url || '',
        last_edited: item.last_edited_time || '',
        created: item.created_time || '',
      };
    });

    return {
      query: params.query,
      total_results: items.length,
      has_more: result.has_more || false,
      results: items,
    };
  },

  /**
   * Read a Notion page's full content (properties + blocks).
   */
  read_page: async (token, params) => {
    const pageId = params.page_id;
    validateNotionId(pageId, 'page_id');

    // Fetch page metadata + blocks in parallel
    const [page, blocksRes] = await Promise.all([
      notionRequest(token, `/pages/${pageId}`),
      notionRequest(token, `/blocks/${pageId}/children?page_size=100`),
    ]);

    // Extract title
    let title = '';
    if (page.properties) {
      for (const prop of Object.values(page.properties)) {
        if (prop.type === 'title') {
          title = richTextToPlain(prop.title);
          break;
        }
      }
    }

    return {
      id: page.id,
      title: title || '(untitled)',
      url: page.url || '',
      created: page.created_time,
      last_edited: page.last_edited_time,
      properties: formatProperties(page.properties),
      content: blocksToText(blocksRes.results || []),
      block_count: (blocksRes.results || []).length,
    };
  },

  /**
   * Query a Notion database with optional filters and sorts.
   */
  read_database: async (token, params) => {
    const databaseId = params.database_id;
    validateNotionId(databaseId, 'database_id');

    const body = {
      page_size: Math.min(params.limit || 20, 100),
    };

    // Simple filter support
    if (params.filter_property && params.filter_value) {
      body.filter = {
        property: params.filter_property,
        rich_text: { contains: params.filter_value },
      };
    }

    // Sort support
    if (params.sort_property) {
      body.sorts = [{
        property: params.sort_property,
        direction: params.sort_direction || 'descending',
      }];
    }

    const result = await notionRequest(token, `/databases/${databaseId}/query`, 'POST', body);

    const rows = (result.results || []).map(page => {
      let title = '';
      const props = {};

      for (const [key, prop] of Object.entries(page.properties || {})) {
        if (prop.type === 'title') {
          title = richTextToPlain(prop.title);
          props[key] = title;
        } else if (prop.type === 'rich_text') {
          props[key] = richTextToPlain(prop.rich_text);
        } else if (prop.type === 'number') {
          props[key] = prop.number;
        } else if (prop.type === 'select') {
          props[key] = prop.select?.name || '';
        } else if (prop.type === 'multi_select') {
          props[key] = (prop.multi_select || []).map(s => s.name).join(', ');
        } else if (prop.type === 'date') {
          props[key] = prop.date?.start || '';
        } else if (prop.type === 'checkbox') {
          props[key] = prop.checkbox;
        } else if (prop.type === 'url') {
          props[key] = prop.url || '';
        } else if (prop.type === 'status') {
          props[key] = prop.status?.name || '';
        } else if (prop.type === 'email') {
          props[key] = prop.email || '';
        } else if (prop.type === 'people') {
          props[key] = (prop.people || []).map(p => p.name || p.id).join(', ');
        }
      }

      return {
        id: page.id,
        title: title || '(untitled)',
        url: page.url || '',
        properties: props,
      };
    });

    // Also get database schema
    let schema = {};
    try {
      const dbMeta = await notionRequest(token, `/databases/${databaseId}`);
      const dbTitle = richTextToPlain(dbMeta.title);
      schema = {
        title: dbTitle,
        property_names: Object.keys(dbMeta.properties || {}),
        property_types: Object.fromEntries(
          Object.entries(dbMeta.properties || {}).map(([k, v]) => [k, v.type])
        ),
      };
    } catch (err) {
      console.warn(`[Notion] Failed to fetch database schema for ${databaseId}:`, err.message);
    }

    return {
      database_id: databaseId,
      schema,
      total_results: rows.length,
      has_more: result.has_more || false,
      rows,
    };
  },

  /**
   * Create a new page in a database or as a child of another page.
   */
  create_page: async (token, params) => {
    const body = { properties: {} };

    if (params.database_id) {
      validateNotionId(params.database_id, 'database_id');
      body.parent = { database_id: params.database_id };
    } else if (params.parent_page_id) {
      validateNotionId(params.parent_page_id, 'parent_page_id');
      body.parent = { page_id: params.parent_page_id };
    } else {
      throw new Error('Either database_id or parent_page_id is required');
    }

    // Set title
    if (params.title) {
      const titleProp = params.title_property || 'Name';
      body.properties[titleProp] = {
        title: [{ text: { content: params.title } }],
      };
    }

    // Set additional properties
    if (params.properties && typeof params.properties === 'object') {
      for (const [key, value] of Object.entries(params.properties)) {
        if (typeof value === 'string') {
          body.properties[key] = { rich_text: [{ text: { content: value } }] };
        } else if (typeof value === 'number') {
          body.properties[key] = { number: value };
        } else if (typeof value === 'boolean') {
          body.properties[key] = { checkbox: value };
        }
      }
    }

    // Add content blocks
    if (params.content) {
      body.children = params.content.split('\n').filter(Boolean).map(line => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: line } }],
        },
      }));
    }

    const result = await notionRequest(token, '/pages', 'POST', body);

    return {
      id: result.id,
      url: result.url,
      created: result.created_time,
      status: 'created',
    };
  },

  /**
   * Update page properties.
   */
  update_page: async (token, params) => {
    const pageId = params.page_id;
    validateNotionId(pageId, 'page_id');

    const body = { properties: {} };

    if (params.properties && typeof params.properties === 'object') {
      for (const [key, value] of Object.entries(params.properties)) {
        if (typeof value === 'string') {
          body.properties[key] = { rich_text: [{ text: { content: value } }] };
        } else if (typeof value === 'number') {
          body.properties[key] = { number: value };
        } else if (typeof value === 'boolean') {
          body.properties[key] = { checkbox: value };
        }
      }
    }

    if (params.title) {
      const titleProp = params.title_property || 'Name';
      body.properties[titleProp] = {
        title: [{ text: { content: params.title } }],
      };
    }

    const result = await notionRequest(token, `/pages/${pageId}`, 'PATCH', body);

    return {
      id: result.id,
      url: result.url,
      last_edited: result.last_edited_time,
      status: 'updated',
    };
  },

  /**
   * Append content blocks to an existing page.
   */
  append_blocks: async (token, params) => {
    const pageId = params.page_id;
    validateNotionId(pageId, 'page_id');
    if (!params.content) throw new Error('content is required');

    const MAX_BLOCKS = 100;
    const MAX_LINE_LEN = 1999;
    const children = params.content.split('\n').filter(Boolean).slice(0, MAX_BLOCKS).map(line => {
      line = line.slice(0, MAX_LINE_LEN);
      // Simple markdown-like parsing
      if (line.startsWith('# ')) {
        return { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ text: { content: line.slice(2) } }] } };
      }
      if (line.startsWith('## ')) {
        return { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: line.slice(3) } }] } };
      }
      if (line.startsWith('### ')) {
        return { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: line.slice(4) } }] } };
      }
      if (line.startsWith('- ')) {
        return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] } };
      }
      if (line === '---') {
        return { object: 'block', type: 'divider', divider: {} };
      }
      return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: line } }] } };
    });

    const result = await notionRequest(token, `/blocks/${pageId}/children`, 'PATCH', { children });

    return {
      page_id: pageId,
      blocks_added: children.length,
      status: 'appended',
    };
  },
};

// =================== PLATFORM REGISTRY ===================

/**
 * Registry of platform action handlers.
 * Key: platform slug, Value: { actionName: handler(token, params) }
 */
const PLATFORM_HANDLERS = {
  notion: NOTION_ACTIONS,
};

/**
 * Execute a platform action with decrypted credentials.
 *
 * @param {string} platformSlug - Platform identifier (e.g., 'notion')
 * @param {string} action - Action name (e.g., 'search', 'read_page')
 * @param {string} encryptedCredentials - Encrypted credentials from DB
 * @param {Object} params - Action parameters
 * @returns {Object} Structured result
 */
async function executePlatformAction(platformSlug, action, encryptedCredentials, params) {
  const handlers = PLATFORM_HANDLERS[platformSlug];
  if (!handlers) {
    throw new Error(`Platform "${platformSlug}" is not yet implemented`);
  }

  const handler = handlers[action];
  if (!handler) {
    throw new Error(`Action "${action}" is not available for platform "${platformSlug}"`);
  }

  // Decrypt credentials
  let token;
  try {
    const decrypted = decryptApiKey(encryptedCredentials);
    // Credentials may be JSON (with extra fields) or a plain token
    try {
      const parsed = JSON.parse(decrypted);
      token = parsed.token || parsed.api_key || parsed.access_token || decrypted;
    } catch {
      token = decrypted;
    }
  } catch (err) {
    throw new Error(`Failed to decrypt credentials: ${err.message}`);
  }

  const startTime = Date.now();
  const result = await handler(token, params);
  const durationMs = Date.now() - startTime;

  return {
    platform: platformSlug,
    action,
    duration_ms: durationMs,
    ...result,
  };
}

/**
 * Test platform credentials by making a lightweight API call.
 */
async function testPlatformCredentials(platformSlug, encryptedCredentials) {
  try {
    let token;
    const decrypted = decryptApiKey(encryptedCredentials);
    try {
      const parsed = JSON.parse(decrypted);
      token = parsed.token || parsed.api_key || parsed.access_token || decrypted;
    } catch {
      token = decrypted;
    }

    if (platformSlug === 'notion') {
      // Light test: search for nothing (just validates the token)
      const result = await notionRequest(token, '/search', 'POST', { query: '', page_size: 1 });
      return {
        success: true,
        message: 'Connected to Notion successfully',
        workspace_info: {
          results_available: result.results?.length || 0,
        },
      };
    }

    return { success: false, message: `Platform "${platformSlug}" test not implemented yet` };
  } catch (err) {
    return {
      success: false,
      message: err.message,
    };
  }
}

/**
 * Format platform action result as readable context for LLM injection.
 */
function formatPlatformResult(result) {
  if (!result) return '[No platform data]';

  let out = `### Platform Data: ${result.platform} / ${result.action} (${result.duration_ms}ms)\n\n`;

  // Remove meta fields
  const { platform, action, duration_ms, ...data } = result;

  // Format based on action type
  if (data.results && Array.isArray(data.results)) {
    out += `**Results:** ${data.total_results || data.results.length} items\n\n`;
    for (const item of data.results) {
      out += `- **${item.title || item.id}** (${item.type || 'item'})`;
      if (item.url) out += ` — [link](${item.url})`;
      if (item.last_edited) out += ` — edited ${item.last_edited}`;
      out += '\n';
    }
  } else if (data.rows && Array.isArray(data.rows)) {
    // Database query results
    out += `**Database:** ${data.schema?.title || data.database_id}\n`;
    out += `**Results:** ${data.total_results || data.rows.length} rows\n\n`;
    for (const row of data.rows) {
      out += `#### ${row.title || row.id}\n`;
      if (row.properties) {
        for (const [k, v] of Object.entries(row.properties)) {
          if (v !== '' && v != null) out += `- **${k}:** ${v}\n`;
        }
      }
      out += '\n';
    }
  } else if (data.content) {
    // Page content
    out += `**Page:** ${data.title || data.id}\n`;
    if (data.properties) out += `\n${data.properties}\n`;
    out += `\n---\n${data.content}\n`;
  } else {
    // Generic: JSON dump
    out += '```json\n' + JSON.stringify(data, null, 2) + '\n```\n';
  }

  return out;
}

module.exports = {
  executePlatformAction,
  testPlatformCredentials,
  formatPlatformResult,
  PLATFORM_HANDLERS,
  // Re-export encryption for credential management
  encryptCredentials: encryptApiKey,
  decryptCredentials: decryptApiKey,
};
