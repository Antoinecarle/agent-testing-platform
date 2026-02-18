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

// =================== GOOGLE TOKEN REFRESH ===================

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Check if Google OAuth credentials need refreshing and refresh if so.
 * @param {string} encryptedCredentials - Encrypted credential blob from DB
 * @returns {{ token: string, updatedEncrypted: string|null }} - Access token + optional updated encrypted blob
 */
async function refreshGoogleTokenIfNeeded(encryptedCredentials) {
  const decrypted = decryptApiKey(encryptedCredentials);
  let parsed;
  try {
    parsed = JSON.parse(decrypted);
  } catch {
    // Not JSON — treat as plain token (legacy, no refresh possible)
    return { token: decrypted, updatedEncrypted: null };
  }

  // If no expires_at or no refresh_token, return as-is
  if (!parsed.expires_at || !parsed.refresh_token) {
    return { token: parsed.access_token || parsed.token || decrypted, updatedEncrypted: null };
  }

  // Check if token expires within 60 seconds
  const bufferMs = 60 * 1000;
  if (parsed.expires_at > Date.now() + bufferMs) {
    // Token still valid
    return { token: parsed.access_token, updatedEncrypted: null };
  }

  // Token expired or about to expire — refresh
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // Can't refresh without OAuth credentials — return current token and hope for the best
    console.warn('[Google OAuth] Cannot refresh: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set');
    return { token: parsed.access_token, updatedEncrypted: null };
  }

  console.log('[Google OAuth] Refreshing expired access token...');
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: parsed.refresh_token,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
  }

  // Update credentials with new access token and expiry
  const updatedCreds = {
    access_token: data.access_token,
    refresh_token: parsed.refresh_token, // Refresh token doesn't change
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    scope: parsed.scope,
  };

  const updatedEncrypted = encryptApiKey(JSON.stringify(updatedCreds));
  console.log('[Google OAuth] Token refreshed successfully');

  return { token: data.access_token, updatedEncrypted };
}

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

// =================== GOOGLE DRIVE API CLIENT ===================

const DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

async function driveRequest(token, endpoint, method = 'GET', body = null, isUpload = false) {
  const baseUrl = isUpload ? DRIVE_UPLOAD_URL : DRIVE_BASE_URL;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body && !isUpload) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isUpload) {
    opts.headers['Content-Type'] = body.mimeType || 'application/octet-stream';
    opts.body = body.content;
  }

  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google Drive API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return { text: await res.text() };
}

/**
 * Map Google Workspace MIME types to export formats.
 */
function getMimeExportType(mimeType) {
  const map = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
    'application/vnd.google-apps.drawing': 'image/png',
  };
  return map[mimeType] || null;
}

/**
 * Format a Drive file object into a readable structure.
 */
function formatDriveFile(file) {
  return {
    id: file.id,
    name: file.name,
    mime_type: file.mimeType,
    size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : null,
    created: file.createdTime || null,
    modified: file.modifiedTime || null,
    web_link: file.webViewLink || null,
    owners: (file.owners || []).map(o => o.displayName || o.emailAddress).join(', '),
    shared: file.shared || false,
  };
}

// =================== GOOGLE DRIVE ACTIONS ===================

const GOOGLE_DRIVE_ACTIONS = {
  /**
   * Search files by query.
   */
  search: async (token, params) => {
    const queryParts = [];
    if (params.query) {
      queryParts.push(`fullText contains '${params.query.replace(/'/g, "\\'")}'`);
    }
    if (params.file_type) {
      const typeMap = {
        document: "mimeType = 'application/vnd.google-apps.document'",
        spreadsheet: "mimeType = 'application/vnd.google-apps.spreadsheet'",
        presentation: "mimeType = 'application/vnd.google-apps.presentation'",
        folder: "mimeType = 'application/vnd.google-apps.folder'",
        pdf: "mimeType = 'application/pdf'",
        image: "mimeType contains 'image/'",
      };
      if (typeMap[params.file_type]) queryParts.push(typeMap[params.file_type]);
    }
    queryParts.push('trashed = false');
    const q = queryParts.join(' and ');
    const limit = Math.min(params.limit || 10, 25);

    const result = await driveRequest(token, `/files?q=${encodeURIComponent(q)}&pageSize=${limit}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners,shared)&orderBy=modifiedTime desc`);

    return {
      query: params.query || '',
      total_results: (result.files || []).length,
      results: (result.files || []).map(formatDriveFile),
    };
  },

  /**
   * List files in a folder.
   */
  list_files: async (token, params) => {
    const folderId = params.folder_id || 'root';
    const limit = Math.min(params.limit || 20, 50);
    const q = `'${folderId}' in parents and trashed = false`;

    const result = await driveRequest(token, `/files?q=${encodeURIComponent(q)}&pageSize=${limit}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners,shared)&orderBy=folder,name`);

    return {
      folder_id: folderId,
      total_results: (result.files || []).length,
      results: (result.files || []).map(formatDriveFile),
    };
  },

  /**
   * Read file metadata + text content.
   */
  read_file: async (token, params) => {
    if (!params.file_id) throw new Error('file_id is required');

    // Get metadata
    const meta = await driveRequest(token, `/files/${params.file_id}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners,shared,description`);

    // Try to get text content
    let content = null;
    const exportType = getMimeExportType(meta.mimeType);
    if (exportType) {
      // Google Workspace file — export
      const exported = await driveRequest(token, `/files/${params.file_id}/export?mimeType=${encodeURIComponent(exportType)}`);
      content = exported.text || null;
    } else if (meta.mimeType && (meta.mimeType.startsWith('text/') || meta.mimeType === 'application/json')) {
      // Plain text / JSON file — download directly
      const downloaded = await driveRequest(token, `/files/${params.file_id}?alt=media`);
      content = downloaded.text || null;
    }

    // Truncate large content
    if (content && content.length > 15000) {
      content = content.slice(0, 15000) + '\n\n[... content truncated at 15,000 characters ...]';
    }

    return {
      ...formatDriveFile(meta),
      description: meta.description || null,
      content,
    };
  },

  /**
   * Create a Google Doc or text file.
   */
  create_file: async (token, params) => {
    if (!params.name) throw new Error('name is required');

    const mimeType = params.mime_type || 'application/vnd.google-apps.document';
    const metadata = {
      name: params.name,
      mimeType,
    };
    if (params.folder_id) {
      metadata.parents = [params.folder_id];
    }

    // Create the file (metadata only)
    const created = await driveRequest(token, '/files?fields=id,name,mimeType,webViewLink', 'POST', metadata);

    // If content provided and it's a Google Doc, insert content via docs API or append
    if (params.content && mimeType === 'application/vnd.google-apps.document') {
      // For Google Docs, we use the Docs API to insert content
      try {
        const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${created.id}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              insertText: {
                location: { index: 1 },
                text: params.content,
              },
            }],
          }),
        });
        if (!docsRes.ok) {
          console.warn(`[GDrive] Failed to insert content into doc: ${docsRes.status}`);
        }
      } catch (err) {
        console.warn(`[GDrive] Failed to insert content: ${err.message}`);
      }
    } else if (params.content && mimeType !== 'application/vnd.google-apps.document') {
      // For plain text files, upload content
      try {
        await driveRequest(token, `/files/${created.id}?uploadType=media`, 'PATCH', {
          mimeType: 'text/plain',
          content: params.content,
        }, true);
      } catch (err) {
        console.warn(`[GDrive] Failed to upload content: ${err.message}`);
      }
    }

    return {
      id: created.id,
      name: created.name,
      mime_type: created.mimeType,
      web_link: created.webViewLink,
      status: 'created',
    };
  },

  /**
   * Create a folder.
   */
  create_folder: async (token, params) => {
    if (!params.name) throw new Error('name is required');

    const metadata = {
      name: params.name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (params.parent_folder_id) {
      metadata.parents = [params.parent_folder_id];
    }

    const created = await driveRequest(token, '/files?fields=id,name,mimeType,webViewLink', 'POST', metadata);

    return {
      id: created.id,
      name: created.name,
      web_link: created.webViewLink,
      status: 'created',
    };
  },

  /**
   * Share a file with email or anyone.
   */
  share_file: async (token, params) => {
    if (!params.file_id) throw new Error('file_id is required');

    const permission = {};
    if (params.anyone) {
      permission.type = 'anyone';
      permission.role = params.role || 'reader';
    } else if (params.email) {
      permission.type = 'user';
      permission.role = params.role || 'reader';
      permission.emailAddress = params.email;
    } else {
      throw new Error('Either email or anyone=true is required');
    }

    const result = await driveRequest(token, `/files/${params.file_id}/permissions`, 'POST', permission);

    // Get updated file info
    const file = await driveRequest(token, `/files/${params.file_id}?fields=id,name,webViewLink`);

    return {
      file_id: params.file_id,
      file_name: file.name,
      permission_id: result.id,
      shared_with: params.anyone ? 'anyone' : params.email,
      role: permission.role,
      web_link: file.webViewLink,
      status: 'shared',
    };
  },
};


// =================== GMAIL API CLIENT ===================

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailRequest(token, endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GMAIL_BASE_URL}${endpoint}`, opts);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gmail API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Decode Gmail base64url-encoded body parts to text.
 */
function decodeGmailBody(payload) {
  if (!payload) return '';

  // Direct body data
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Multi-part messages — find text/plain or text/html
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    // Fall back to text/html (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    // Nested parts (multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = decodeGmailBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}

/**
 * Extract header value from Gmail message headers.
 */
function getGmailHeader(headers, name) {
  if (!headers || !Array.isArray(headers)) return '';
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

/**
 * Build an RFC 2822 email and base64url encode it for Gmail send/draft API.
 */
function buildRawEmail(to, subject, body, cc, bcc, threadId, inReplyTo) {
  const lines = [];
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject || '(no subject)'}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }
  lines.push('');
  lines.push(body || '');

  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

// =================== GMAIL ACTIONS ===================

const GMAIL_ACTIONS = {
  /**
   * Search emails using Gmail search syntax.
   */
  search: async (token, params) => {
    const q = params.query || '';
    const limit = Math.min(params.limit || 10, 20);
    let endpoint = `/messages?q=${encodeURIComponent(q)}&maxResults=${limit}`;
    if (params.label) {
      endpoint += `&labelIds=${encodeURIComponent(params.label)}`;
    }

    const list = await gmailRequest(token, endpoint);
    if (!list.messages || list.messages.length === 0) {
      return { query: q, total_results: 0, results: [] };
    }

    // Fetch metadata for each message (batch-style with parallel requests)
    const messages = await Promise.all(
      list.messages.slice(0, limit).map(async (msg) => {
        try {
          const detail = await gmailRequest(token, `/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`);
          return {
            id: detail.id,
            thread_id: detail.threadId,
            subject: getGmailHeader(detail.payload?.headers, 'Subject') || '(no subject)',
            from: getGmailHeader(detail.payload?.headers, 'From'),
            to: getGmailHeader(detail.payload?.headers, 'To'),
            date: getGmailHeader(detail.payload?.headers, 'Date'),
            snippet: detail.snippet || '',
            labels: detail.labelIds || [],
          };
        } catch {
          return { id: msg.id, error: 'Failed to fetch' };
        }
      })
    );

    return {
      query: q,
      total_results: list.resultSizeEstimate || messages.length,
      results: messages,
    };
  },

  /**
   * Read full email content.
   */
  read_email: async (token, params) => {
    if (!params.message_id) throw new Error('message_id is required');

    const msg = await gmailRequest(token, `/messages/${params.message_id}?format=full`);

    const body = decodeGmailBody(msg.payload);

    // Extract attachments info
    const attachments = [];
    function findAttachments(parts) {
      if (!parts) return;
      for (const part of parts) {
        if (part.filename && part.filename.length > 0) {
          attachments.push({
            filename: part.filename,
            mime_type: part.mimeType,
            size: part.body?.size || 0,
          });
        }
        if (part.parts) findAttachments(part.parts);
      }
    }
    findAttachments(msg.payload?.parts);

    return {
      id: msg.id,
      thread_id: msg.threadId,
      subject: getGmailHeader(msg.payload?.headers, 'Subject') || '(no subject)',
      from: getGmailHeader(msg.payload?.headers, 'From'),
      to: getGmailHeader(msg.payload?.headers, 'To'),
      cc: getGmailHeader(msg.payload?.headers, 'Cc'),
      date: getGmailHeader(msg.payload?.headers, 'Date'),
      message_id_header: getGmailHeader(msg.payload?.headers, 'Message-ID'),
      labels: msg.labelIds || [],
      body: body.slice(0, 15000),
      attachments,
    };
  },

  /**
   * Send an email.
   */
  send_email: async (token, params) => {
    if (!params.to) throw new Error('to (recipient email) is required');
    if (!params.subject && !params.body) throw new Error('subject or body is required');

    const raw = buildRawEmail(params.to, params.subject, params.body, params.cc, params.bcc);
    const result = await gmailRequest(token, '/messages/send', 'POST', { raw });

    return {
      id: result.id,
      thread_id: result.threadId,
      to: params.to,
      subject: params.subject,
      status: 'sent',
    };
  },

  /**
   * Reply to a thread.
   */
  reply_email: async (token, params) => {
    if (!params.message_id) throw new Error('message_id is required');
    if (!params.body) throw new Error('body is required');

    // Get original message to extract thread info
    const original = await gmailRequest(token, `/messages/${params.message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`);
    const originalSubject = getGmailHeader(original.payload?.headers, 'Subject') || '';
    const originalFrom = getGmailHeader(original.payload?.headers, 'From');
    const originalMessageId = getGmailHeader(original.payload?.headers, 'Message-ID');

    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
    const raw = buildRawEmail(originalFrom, subject, params.body, null, null, original.threadId, originalMessageId);

    const result = await gmailRequest(token, '/messages/send', 'POST', {
      raw,
      threadId: original.threadId,
    });

    return {
      id: result.id,
      thread_id: result.threadId,
      in_reply_to: params.message_id,
      subject,
      status: 'sent',
    };
  },

  /**
   * List all labels/folders.
   */
  list_labels: async (token) => {
    const result = await gmailRequest(token, '/labels');
    const labels = (result.labels || []).map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      messages_total: l.messagesTotal || 0,
      messages_unread: l.messagesUnread || 0,
    }));

    return {
      total: labels.length,
      results: labels,
    };
  },

  /**
   * Create a draft email.
   */
  create_draft: async (token, params) => {
    if (!params.to) throw new Error('to (recipient email) is required');

    const raw = buildRawEmail(params.to, params.subject, params.body, params.cc, params.bcc);
    const result = await gmailRequest(token, '/drafts', 'POST', {
      message: { raw },
    });

    return {
      id: result.id,
      message_id: result.message?.id,
      to: params.to,
      subject: params.subject,
      status: 'draft_created',
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
  'google-drive': GOOGLE_DRIVE_ACTIONS,
  gmail: GMAIL_ACTIONS,
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
async function executePlatformAction(platformSlug, action, encryptedCredentials, params, context) {
  const handlers = PLATFORM_HANDLERS[platformSlug];
  if (!handlers) {
    throw new Error(`Platform "${platformSlug}" is not yet implemented`);
  }

  const handler = handlers[action];
  if (!handler) {
    throw new Error(`Action "${action}" is not available for platform "${platformSlug}"`);
  }

  // Decrypt credentials (with Google token refresh if needed)
  let token;
  let updatedEncrypted = null;
  try {
    if (platformSlug === 'google-drive' || platformSlug === 'gmail') {
      const refreshResult = await refreshGoogleTokenIfNeeded(encryptedCredentials);
      token = refreshResult.token;
      updatedEncrypted = refreshResult.updatedEncrypted;
    } else {
      const decrypted = decryptApiKey(encryptedCredentials);
      // Credentials may be JSON (with extra fields) or a plain token
      try {
        const parsed = JSON.parse(decrypted);
        token = parsed.token || parsed.api_key || parsed.access_token || decrypted;
      } catch {
        token = decrypted;
      }
    }
  } catch (err) {
    throw new Error(`Failed to decrypt credentials: ${err.message}`);
  }

  // If token was refreshed, update DB credential (preserve existing metadata)
  if (updatedEncrypted && context?.userId && context?.platformId) {
    try {
      const db = require('../db');
      const existing = await db.getPlatformCredential(context.userId, context.platformId);
      const existingMeta = existing?.credential_metadata || {};
      await db.savePlatformCredential(context.userId, context.platformId, updatedEncrypted, {
        ...existingMeta,
        auth_type: 'oauth2',
        last_refreshed: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Platform] Failed to save refreshed token:', err.message);
    }
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
async function testPlatformCredentials(platformSlug, encryptedCredentials, context) {
  try {
    let token;
    if (platformSlug === 'google-drive' || platformSlug === 'gmail') {
      const refreshResult = await refreshGoogleTokenIfNeeded(encryptedCredentials);
      token = refreshResult.token;
      // Save refreshed token if applicable (preserve existing metadata)
      if (refreshResult.updatedEncrypted && context?.userId && context?.platformId) {
        try {
          const db = require('../db');
          const existing = await db.getPlatformCredential(context.userId, context.platformId);
          const existingMeta = existing?.credential_metadata || {};
          await db.savePlatformCredential(context.userId, context.platformId, refreshResult.updatedEncrypted, {
            ...existingMeta,
            auth_type: 'oauth2',
            last_refreshed: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[Platform] Failed to save refreshed token during test:', err.message);
        }
      }
    } else {
      const decrypted = decryptApiKey(encryptedCredentials);
      try {
        const parsed = JSON.parse(decrypted);
        token = parsed.token || parsed.api_key || parsed.access_token || decrypted;
      } catch {
        token = decrypted;
      }
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

    if (platformSlug === 'google-drive') {
      const result = await driveRequest(token, '/about?fields=user,storageQuota');
      return {
        success: true,
        message: `Connected as ${result.user?.displayName || result.user?.emailAddress || 'unknown'}`,
        drive_info: {
          email: result.user?.emailAddress,
          storage_used: result.storageQuota?.usage ? `${Math.round(parseInt(result.storageQuota.usage) / 1024 / 1024)} MB` : null,
        },
      };
    }

    if (platformSlug === 'gmail') {
      const result = await gmailRequest(token, '/profile');
      return {
        success: true,
        message: `Connected as ${result.emailAddress}`,
        gmail_info: {
          email: result.emailAddress,
          messages_total: result.messagesTotal,
          threads_total: result.threadsTotal,
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
  refreshGoogleTokenIfNeeded,
  PLATFORM_HANDLERS,
  // Re-export encryption for credential management
  encryptCredentials: encryptApiKey,
  decryptCredentials: decryptApiKey,
};
