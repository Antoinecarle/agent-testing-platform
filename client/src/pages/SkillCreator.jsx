import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  File, Folder, FolderPlus, FilePlus, ChevronRight, ChevronDown,
  Plus, MessageSquare, Sparkles, Send, X,
  Type, Code, List, Table, AlertCircle, Minus, Save,
  Check, Trash2, PanelRight, Download, ArrowLeft, Wand2,
  FileText, Layout, Pencil, Lightbulb, RefreshCw, Zap,
  ArrowRight, FolderTree
} from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

// --- Markdown <-> Blocks ---

function parseMarkdownToBlocks(md) {
  if (!md || !md.trim()) return [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];

  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) { i++; continue; }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ id: crypto.randomUUID(), type: 'code', content: codeLines.join('\n'), lang });
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push({ id: crypto.randomUUID(), type: 'heading3', content: line.slice(4) });
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ id: crypto.randomUUID(), type: 'heading2', content: line.slice(3) });
      i++; continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ id: crypto.randomUUID(), type: 'heading1', content: line.slice(2) });
      i++; continue;
    }

    // Divider
    if (line.match(/^---+\s*$/)) {
      blocks.push({ id: crypto.randomUUID(), type: 'divider', content: '' });
      i++; continue;
    }

    // Callout
    if (line.startsWith('> ')) {
      const calloutLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        calloutLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ id: crypto.randomUUID(), type: 'callout', content: calloutLines.join('\n') });
      continue;
    }

    // List (bullet)
    if (line.match(/^[-*] /)) {
      const listLines = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listLines.push(lines[i].replace(/^[-*] /, ''));
        i++;
      }
      blocks.push({ id: crypto.randomUUID(), type: 'list', content: listLines.join('\n') });
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const listLines = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        listLines.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push({ id: crypto.randomUUID(), type: 'numbered', content: listLines.join('\n') });
      continue;
    }

    // Table
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: crypto.randomUUID(), type: 'table', content: tableLines.join('\n') });
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('> ') && !lines[i].startsWith('---') && !lines[i].startsWith('|') && !lines[i].match(/^[-*] /) && !lines[i].match(/^\d+\. /)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ id: crypto.randomUUID(), type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks.length > 0 ? blocks : [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];
}

function serializeBlocksToMarkdown(blocks) {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading1': return `# ${b.content}`;
      case 'heading2': return `## ${b.content}`;
      case 'heading3': return `### ${b.content}`;
      case 'code': return `\`\`\`${b.lang || ''}\n${b.content}\n\`\`\``;
      case 'list': return b.content.split('\n').map(l => `- ${l}`).join('\n');
      case 'numbered': return b.content.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
      case 'callout': return b.content.split('\n').map(l => `> ${l}`).join('\n');
      case 'table': return b.content;
      case 'divider': return '---';
      default: return b.content;
    }
  }).join('\n\n');
}

// --- File Tree Component ---

function FileTreeItem({ item, depth = 0, currentFilePath, onOpenFile, expandedFolders, onToggleFolder, onDeleteFile }) {
  const isFolder = item.type === 'directory';
  const isActive = currentFilePath === item.path;
  const isExpanded = expandedFolders.includes(item.path);

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', paddingLeft: `${12 + depth * 16}px`,
          fontSize: '12px', cursor: 'pointer', borderRadius: '4px', margin: '1px 6px',
          color: isActive ? t.violet : t.ts,
          backgroundColor: isActive ? t.violetG : 'transparent',
          transition: 'background 0.1s',
        }}
        onClick={() => isFolder ? onToggleFolder(item.path) : onOpenFile(item.path)}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {isFolder ? (
          isExpanded ? <ChevronDown size={12} style={{ flexShrink: 0 }} /> : <ChevronRight size={12} style={{ flexShrink: 0 }} />
        ) : null}
        {isFolder ? <Folder size={13} style={{ flexShrink: 0, color: t.tm }} /> : <File size={13} style={{ flexShrink: 0, color: t.tm }} />}
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
      </div>
      {isFolder && isExpanded && item.children && item.children.map((child, idx) => (
        <FileTreeItem key={child.path || idx} item={child} depth={depth + 1} currentFilePath={currentFilePath}
          onOpenFile={onOpenFile} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onDeleteFile={onDeleteFile} />
      ))}
    </>
  );
}

// --- Block Type Menu Items ---
const BLOCK_TYPES = [
  { id: 'paragraph', label: 'Text', icon: Type },
  { id: 'heading1', label: 'Heading 1', icon: Type },
  { id: 'heading2', label: 'Heading 2', icon: Type },
  { id: 'heading3', label: 'Heading 3', icon: Type },
  { id: 'code', label: 'Code Block', icon: Code },
  { id: 'list', label: 'Bullet List', icon: List },
  { id: 'numbered', label: 'Numbered List', icon: List },
  { id: 'table', label: 'Table', icon: Table },
  { id: 'callout', label: 'Callout', icon: AlertCircle },
  { id: 'divider', label: 'Divider', icon: Minus },
];

// --- Main Component ---

export default function SkillCreator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkToAgent = searchParams.get('agent');
  const isNewSkill = !id;

  // State
  const [skill, setSkill] = useState(null);
  const [skillId, setSkillId] = useState(id || null);
  const [fileTree, setFileTree] = useState([]);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [slashMenu, setSlashMenu] = useState({ visible: false, x: 0, y: 0, blockId: null });
  const [ghostText, setGhostText] = useState('');
  const [ghostBlockId, setGhostBlockId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(isNewSkill);
  const [templates, setTemplates] = useState([]);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [aiTab, setAiTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  // AI Suggestions state
  const [suggestions, setSuggestions] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const ghostTimer = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 4000); return () => clearTimeout(t); }
  }, [error]);

  // Load skill or templates on mount
  useEffect(() => {
    if (id) {
      loadSkill(id);
    } else {
      loadTemplates();
    }
  }, [id]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSkill = async (skillId) => {
    try {
      const data = await api(`/api/skills/${skillId}`);
      setSkill(data);
      setSkillId(skillId);
      // Load file tree
      let filesData = await api(`/api/skills/${skillId}/files`);
      let tree = filesData.tree || [];

      // If no files on disk, auto-init from blank template
      if (!tree || tree.length === 0) {
        try {
          const initData = await api(`/api/skills/${skillId}/init`, {
            method: 'POST',
            body: JSON.stringify({ template: 'blank' }),
          });
          tree = initData.tree || [];
        } catch (initErr) {
          console.warn('Auto-init failed:', initErr);
        }
      }

      setFileTree(tree);
      // Expand root folders
      setExpandedFolders(tree.filter(i => i.type === 'directory').map(i => i.path));
      // Auto-open SKILL.md if it exists in the tree
      const hasEntryPoint = data.entry_point && flattenFileNames(tree).includes(data.entry_point);
      if (hasEntryPoint) openFile(skillId, data.entry_point);
      // Create or load conversation
      await initConversation(skillId, data.name);
    } catch (err) {
      setError('Failed to load skill');
      console.error(err);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await api('/api/skill-creator/templates');
      setTemplates(data.templates || []);
    } catch (err) { console.error(err); }
  };

  const initConversation = async (sId, name) => {
    try {
      const data = await api('/api/skill-creator/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: name || 'New Skill', skillId: sId }),
      });
      setConversationId(data.conversation?.id);
    } catch (err) { console.error(err); }
  };

  const openFile = async (sId, filePath) => {
    if (dirty && currentFilePath) {
      await saveFile(sId);
    }
    try {
      const data = await api(`/api/skills/${sId}/files/${filePath}`);
      setCurrentFilePath(filePath);
      setBlocks(parseMarkdownToBlocks(data.content || ''));
      setActiveBlockId(null);
      setDirty(false);
      setGhostText('');
    } catch (err) {
      setError('Failed to open file');
      console.error(err);
    }
  };

  const saveFile = async (sId) => {
    const sid = sId || skillId;
    if (!currentFilePath || !sid) return;
    setIsSaving(true);
    try {
      const md = serializeBlocksToMarkdown(blocks);
      const res = await api(`/api/skills/${sid}/files/${currentFilePath}`, {
        method: 'PUT',
        body: JSON.stringify({ content: md }),
      });
      setFileTree(res.tree || fileTree);
      setDirty(false);
    } catch (err) {
      setError('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitTemplate = async (templateSlug) => {
    // First create the skill with a unique name
    try {
      const suffix = Date.now().toString(36).slice(-4);
      const baseName = templateSlug === 'blank' ? 'New Skill' :
        templateSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const skillName = `${baseName} ${suffix}`;
      const skillData = await api('/api/skills', {
        method: 'POST',
        body: JSON.stringify({ name: skillName, description: '', category: 'general' }),
      });
      const newId = skillData.id;
      // Init from template
      await api(`/api/skills/${newId}/init`, {
        method: 'POST',
        body: JSON.stringify({ template: templateSlug }),
      });
      // Auto-assign to agent if linked
      if (linkToAgent) {
        try {
          await api(`/api/skills/${newId}/assign/${linkToAgent}`, { method: 'POST' });
        } catch (err) { console.error('Auto-assign failed:', err); }
      }
      setShowTemplates(false);
      navigate(`/skills/${newId}/edit${linkToAgent ? `?agent=${linkToAgent}` : ''}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create skill');
    }
  };

  const handleToggleFolder = (path) => {
    setExpandedFolders(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !skillId) return;
    try {
      const res = await api(`/api/skills/${skillId}/files/${newFileName.trim()}`, {
        method: 'PUT',
        body: JSON.stringify({ content: '' }),
      });
      setFileTree(res.tree || fileTree);
      setShowNewFile(false);
      setNewFileName('');
      openFile(skillId, newFileName.trim());
    } catch (err) { setError('Failed to create file'); }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !skillId) return;
    try {
      const res = await api(`/api/skills/${skillId}/dirs`, {
        method: 'POST',
        body: JSON.stringify({ path: newFolderName.trim() }),
      });
      setFileTree(res.tree || fileTree);
      setShowNewFolder(false);
      setNewFolderName('');
      setExpandedFolders(prev => [...prev, newFolderName.trim()]);
    } catch (err) { setError('Failed to create folder'); }
  };

  const handleDeleteFile = async (filePath) => {
    if (!skillId) return;
    try {
      const res = await api(`/api/skills/${skillId}/files/${filePath}`, { method: 'DELETE' });
      setFileTree(res.tree || fileTree);
      if (currentFilePath === filePath) {
        setCurrentFilePath(null);
        setBlocks([]);
      }
    } catch (err) { setError('Failed to delete file'); }
  };

  // --- Block Handlers ---

  const updateBlock = (blockId, content) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    setDirty(true);
    setGhostText('');
    setGhostBlockId(null);
    triggerCompletion(blockId, content);
  };

  const changeBlockType = (blockId, type) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, type } : b));
    setSlashMenu({ visible: false, x: 0, y: 0, blockId: null });
    setDirty(true);
  };

  const addBlock = (afterId, type = 'paragraph') => {
    const newBlock = { id: crypto.randomUUID(), type, content: '' };
    if (!afterId) {
      setBlocks(prev => [...prev, newBlock]);
    } else {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
    }
    setActiveBlockId(newBlock.id);
    setDirty(true);
  };

  const deleteBlock = (blockId) => {
    if (blocks.length <= 1) return;
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    setActiveBlockId(null);
    setDirty(true);
  };

  const handleBlockKeyDown = (e, blockId) => {
    const block = blocks.find(b => b.id === blockId);

    if (e.key === '/' && block && block.content === '') {
      e.preventDefault();
      const rect = e.target.getBoundingClientRect();
      setSlashMenu({ visible: true, x: rect.left, y: rect.bottom + 4, blockId });
      return;
    }

    if (e.key === 'Tab' && ghostText && ghostBlockId === blockId) {
      e.preventDefault();
      updateBlock(blockId, block.content + ghostText);
      setGhostText('');
      setGhostBlockId(null);
      return;
    }

    if (e.key === 'Escape') {
      setGhostText('');
      setGhostBlockId(null);
      setSlashMenu({ ...slashMenu, visible: false });
      setActiveBlockId(null);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && block?.type !== 'code' && block?.type !== 'table') {
      e.preventDefault();
      addBlock(blockId);
      return;
    }

    if (e.key === 'Backspace' && block?.content === '' && blocks.length > 1) {
      e.preventDefault();
      deleteBlock(blockId);
    }
  };

  // --- AI Completion ---

  const triggerCompletion = useCallback((blockId, content) => {
    if (!content || content.length < 10 || !conversationId) return;

    clearTimeout(ghostTimer.current);
    ghostTimer.current = setTimeout(async () => {
      try {
        const blockIndex = blocks.findIndex(b => b.id === blockId);
        const blocksBefore = blocks.slice(Math.max(0, blockIndex - 5), blockIndex).map(b => b.content);

        const res = await api(`/api/skill-creator/conversations/${conversationId}/complete`, {
          method: 'POST',
          body: JSON.stringify({
            fileContext: currentFilePath,
            blocksBefore,
            currentBlock: content,
            cursorPosition: content.length,
            skillContext: { name: skill?.name, files: flattenFileNames(fileTree) },
          }),
        });
        if (res.completion) {
          setGhostText(res.completion);
          setGhostBlockId(blockId);
        }
      } catch (err) { /* silent */ }
    }, 2000);
  }, [blocks, conversationId, currentFilePath, skill, fileTree]);

  // --- Chat ---

  const sendMessage = async () => {
    if (!chatInput.trim() || !conversationId) return;
    const msg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await api(`/api/skill-creator/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: msg, fileContext: currentFilePath }),
      });
      if (res.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.message.content }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (err.message || 'Failed to get response') }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateFile = async () => {
    if (!conversationId || !currentFilePath) return;
    setGenerating(true);
    try {
      const res = await api(`/api/skill-creator/conversations/${conversationId}/generate-file`, {
        method: 'POST',
        body: JSON.stringify({ filePath: currentFilePath }),
      });
      if (res.content) {
        setBlocks(parseMarkdownToBlocks(res.content));
        setDirty(true);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Generated content for ${currentFilePath} (${res.content.length} chars). Review it in the editor and click Save when ready.`
        }]);
      }
    } catch (err) { setError(err.message || 'Generate failed'); }
    finally { setGenerating(false); }
  };

  const handleGenerateAll = async () => {
    if (!conversationId) return;
    setGenerating(true);
    try {
      const res = await api(`/api/skill-creator/conversations/${conversationId}/generate-structure`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.tree) {
        setFileTree(res.tree);
        // Expand all folders to show generated files
        const allFolders = [];
        const walkForFolders = (items) => {
          for (const item of items) {
            if (item.type === 'directory') {
              allFolders.push(item.path);
              if (item.children) walkForFolders(item.children);
            }
          }
        };
        walkForFolders(res.tree);
        setExpandedFolders(allFolders);
        // Open SKILL.md to show the new overview
        if (skillId) openFile(skillId, 'SKILL.md');
        // Show success message in chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Generated ${res.files} files (${res.totalFiles} total). Check the file tree on the left — all files have been created with detailed content. Click any file to view/edit it.`
        }]);
      }
    } catch (err) {
      setError(err.message || 'Generate all failed — try describing your skill in the chat first');
    }
    finally { setGenerating(false); }
  };

  // --- Rename Skill ---
  const startRename = () => {
    setRenameValue(skill?.name || '');
    setIsRenaming(true);
  };

  const handleRename = async () => {
    const newName = renameValue.trim();
    if (!newName || !skillId || newName === skill?.name) {
      setIsRenaming(false);
      return;
    }
    setRenameSaving(true);
    try {
      const updated = await api(`/api/skills/${skillId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      setSkill(prev => ({ ...prev, ...updated }));
      setIsRenaming(false);
    } catch (err) {
      setError(err.message || 'Failed to rename skill');
    } finally {
      setRenameSaving(false);
    }
  };

  // --- AI Suggestions ---
  const loadSuggestions = async (type = 'all') => {
    if (!conversationId) return;
    setSuggestionsLoading(true);
    try {
      const res = await api(`/api/skill-creator/conversations/${conversationId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      setSuggestions(res.suggestions);
    } catch (err) {
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const applyNameSuggestion = async (name) => {
    if (!skillId) return;
    setRenameSaving(true);
    try {
      const updated = await api(`/api/skills/${skillId}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      setSkill(prev => ({ ...prev, ...updated }));
    } catch (err) {
      setError(err.message || 'Failed to apply name');
    } finally {
      setRenameSaving(false);
    }
  };

  // Helpers
  function flattenFileNames(tree) {
    const names = [];
    function walk(items) {
      for (const item of items) {
        names.push(item.path || item.name);
        if (item.children) walk(item.children);
      }
    }
    walk(tree || []);
    return names;
  }

  // --- Render ---

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', backgroundColor: t.bg, color: t.tp, overflow: 'hidden' }}>

      {/* Agent Link Banner */}
      {linkToAgent && (
        <div style={{
          padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(90deg, rgba(6,182,212,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          borderBottom: '1px solid rgba(6,182,212,0.2)', fontSize: '12px', flexShrink: 0,
        }}>
          <Wand2 size={13} style={{ color: '#06b6d4' }} />
          <span style={{ color: t.ts }}>
            This skill will be auto-linked to agent
          </span>
          <span style={{
            fontWeight: 600, color: '#06b6d4', padding: '1px 8px', borderRadius: '100px',
            background: 'rgba(6,182,212,0.15)', fontSize: '11px',
          }}>
            {linkToAgent}
          </span>
          <button onClick={() => navigate(`/agents/${linkToAgent}`)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: t.tm,
            cursor: 'pointer', fontSize: '11px', textDecoration: 'underline',
          }}>
            Back to agent
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* LEFT — File Tree Sidebar */}
      <div style={{ width: '240px', borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', backgroundColor: t.surface, flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <button onClick={() => navigate('/skills')} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
              <ArrowLeft size={14} />
            </button>
            {isRenaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                  style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px', fontWeight: 600 }}
                  disabled={renameSaving}
                />
                <button onClick={handleRename} disabled={renameSaving} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <Check size={13} />
                </button>
                <button onClick={() => setIsRenaming(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={startRename} title="Click to rename">
                <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {skill?.name || 'New Skill'}
                </span>
                <Pencil size={10} style={{ color: t.tm, flexShrink: 0, opacity: 0.5 }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
            <button onClick={() => setShowNewFile(true)} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', padding: '4px', display: 'flex' }} title="New File">
              <FilePlus size={14} />
            </button>
            <button onClick={() => setShowNewFolder(true)} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', padding: '4px', display: 'flex' }} title="New Folder">
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* New file/folder inputs */}
        {showNewFile && (
          <div style={{ padding: '6px 10px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '4px' }}>
            <input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="path/file.md"
              onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
              style={{ ...inputStyle, padding: '6px 8px', fontSize: '11px' }} autoFocus />
            <button onClick={handleCreateFile} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
            <button onClick={() => setShowNewFile(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
          </div>
        )}
        {showNewFolder && (
          <div style={{ padding: '6px 10px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '4px' }}>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="folder-name"
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              style={{ ...inputStyle, padding: '6px 8px', fontSize: '11px' }} autoFocus />
            <button onClick={handleCreateFolder} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
            <button onClick={() => setShowNewFolder(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
          </div>
        )}

        {/* File tree */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
          {fileTree.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: t.tm, fontSize: '11px' }}>
              No files yet. Use a template or create a file.
            </div>
          ) : (
            fileTree.map((item, idx) => (
              <FileTreeItem key={item.path || idx} item={item} currentFilePath={currentFilePath}
                onOpenFile={(p) => openFile(skillId, p)} expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder} onDeleteFile={handleDeleteFile} />
            ))
          )}
        </div>

        {/* Template button */}
        <div style={{ padding: '10px', borderTop: `1px solid ${t.border}` }}>
          <button onClick={() => setShowTemplates(true)}
            style={{ width: '100%', padding: '7px', borderRadius: '6px', backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`, color: t.ts, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Sparkles size={12} /> From Template
          </button>
        </div>
      </div>

      {/* CENTER — Block Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '8px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.bg, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: t.ts }}>
            <FileText size={12} style={{ color: t.tm }} />
            <span style={{ color: t.tm }}>{skill?.name || 'Skill'}</span>
            {currentFilePath && (
              <>
                <ChevronRight size={10} style={{ color: t.tm }} />
                <span style={{ color: t.tp, fontWeight: 500 }}>{currentFilePath}</span>
              </>
            )}
            {dirty && <span style={{ fontSize: '10px', color: t.warning, marginLeft: '6px' }}>unsaved</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => saveFile()} disabled={isSaving || !dirty}
              style={{ padding: '5px 14px', borderRadius: '4px', backgroundColor: dirty ? t.tp : t.surfaceEl, color: dirty ? t.bg : t.tm, border: 'none', fontSize: '11px', fontWeight: 600, cursor: dirty ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '5px', opacity: dirty ? 1 : 0.5 }}>
              <Save size={12} /> {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              style={{ background: isAIPanelOpen ? t.violetG : t.surfaceEl, border: `1px solid ${isAIPanelOpen ? t.violet : t.border}`, color: isAIPanelOpen ? t.violet : t.ts, padding: '5px', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}>
              <PanelRight size={14} />
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 0' }}>
          {!currentFilePath ? (
            <div style={{ textAlign: 'center', marginTop: '120px', color: t.tm }}>
              <Layout size={36} style={{ marginBottom: '12px', opacity: 0.15 }} />
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>Select a file from the sidebar</div>
              <div style={{ fontSize: '11px', color: t.tm }}>or create a new one to start editing</div>
            </div>
          ) : (
            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 40px' }}>
              {blocks.map((block, idx) => (
                <div key={block.id} style={{ position: 'relative', marginBottom: '2px', group: true }}
                  onMouseEnter={e => { const btn = e.currentTarget.querySelector('.add-btn'); if (btn) btn.style.opacity = '1'; }}
                  onMouseLeave={e => { const btn = e.currentTarget.querySelector('.add-btn'); if (btn) btn.style.opacity = '0'; }}
                >
                  {/* Block content */}
                  {activeBlockId === block.id ? (
                    <div style={{ position: 'relative' }}>
                      <textarea
                        autoFocus
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
                        style={{
                          width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${t.border}`,
                          borderRadius: '4px', color: t.tp, outline: 'none', boxSizing: 'border-box', resize: 'none',
                          padding: '8px 12px',
                          fontSize: block.type === 'heading1' ? '24px' : block.type === 'heading2' ? '18px' : block.type === 'heading3' ? '15px' : '14px',
                          fontWeight: block.type.startsWith('heading') ? 600 : 400,
                          fontFamily: block.type === 'code' || block.type === 'table' ? t.mono : 'inherit',
                          lineHeight: '1.6',
                          minHeight: block.type === 'code' ? '100px' : '36px',
                        }}
                        rows={Math.max(1, block.content.split('\n').length)}
                      />
                      {ghostText && ghostBlockId === block.id && (
                        <div style={{ position: 'absolute', bottom: '-20px', left: '12px', fontSize: '11px', color: t.tm, fontStyle: 'italic' }}>
                          <span style={{ opacity: 0.6 }}>Tab</span> {ghostText.slice(0, 60)}{ghostText.length > 60 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => setActiveBlockId(block.id)}
                      style={{ padding: '4px 12px', borderRadius: '4px', cursor: 'text', minHeight: '24px', border: '1px solid transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {block.type === 'heading1' && <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>{block.content || <span style={{ color: t.tm }}>Heading 1</span>}</h1>}
                      {block.type === 'heading2' && <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>{block.content || <span style={{ color: t.tm }}>Heading 2</span>}</h2>}
                      {block.type === 'heading3' && <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{block.content || <span style={{ color: t.tm }}>Heading 3</span>}</h3>}
                      {block.type === 'paragraph' && <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.7', color: block.content ? t.tp : t.tm }}>{block.content || 'Type "/" for commands...'}</p>}
                      {block.type === 'code' && (
                        <pre style={{ margin: 0, padding: '12px', backgroundColor: t.surface, borderRadius: '6px', fontSize: '12px', fontFamily: t.mono, lineHeight: '1.6', border: `1px solid ${t.border}`, overflow: 'auto' }}>
                          <code>{block.content || '// code...'}</code>
                        </pre>
                      )}
                      {block.type === 'list' && (
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7' }}>
                          {(block.content || '').split('\n').map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      )}
                      {block.type === 'numbered' && (
                        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7' }}>
                          {(block.content || '').split('\n').map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
                      )}
                      {block.type === 'table' && (
                        <pre style={{ margin: 0, fontSize: '12px', fontFamily: t.mono, lineHeight: '1.5', color: t.ts }}>{block.content || '| col1 | col2 |'}</pre>
                      )}
                      {block.type === 'callout' && (
                        <div style={{ padding: '10px 14px', borderLeft: `3px solid ${t.violet}`, backgroundColor: t.violetG, borderRadius: '0 6px 6px 0', fontSize: '13px', lineHeight: '1.6' }}>
                          {block.content || 'Note...'}
                        </div>
                      )}
                      {block.type === 'divider' && <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '12px 0' }} />}
                    </div>
                  )}

                  {/* Add block between */}
                  <div className="add-btn" style={{ position: 'absolute', left: '-28px', top: '50%', transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.15s' }}>
                    <button onClick={() => addBlock(block.id)}
                      style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — AI Panel */}
      {isAIPanelOpen && (
        <div style={{ width: '320px', borderLeft: `1px solid ${t.border}`, backgroundColor: t.surface, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '12px' }}>
            {['chat', 'suggest', 'complete'].map(tab => (
              <button key={tab} onClick={() => { setAiTab(tab); if (tab === 'suggest' && !suggestions && !suggestionsLoading) loadSuggestions(); }}
                style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: aiTab === tab ? t.tp : t.tm, cursor: 'pointer', paddingBottom: '4px', borderBottom: aiTab === tab ? `2px solid ${t.violet}` : '2px solid transparent' }}>
                {tab === 'chat' ? 'AI Chat' : tab === 'suggest' ? 'Suggestions' : 'Autocomplete'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {aiTab === 'suggest' ? (
            <>
              {/* Suggestions Panel */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {suggestionsLoading ? (
                  <div style={{ padding: '40px 12px', textAlign: 'center' }}>
                    <RefreshCw size={20} style={{ color: t.violet, marginBottom: '10px', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: '12px', color: t.ts }}>Analyzing your skill...</div>
                  </div>
                ) : !suggestions ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                    <Lightbulb size={20} style={{ color: t.tm, marginBottom: '10px', opacity: 0.3 }} />
                    <div style={{ fontSize: '12px', color: t.ts, marginBottom: '14px' }}>Get AI-powered suggestions to improve your skill</div>
                    <button onClick={() => loadSuggestions()} disabled={!conversationId}
                      style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: t.violet, border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: conversationId ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: conversationId ? 1 : 0.4 }}>
                      <Zap size={12} /> Analyze Skill
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Refresh */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setSuggestions(null); loadSuggestions(); }}
                        style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={10} /> Refresh
                      </button>
                    </div>

                    {/* Name Suggestions */}
                    {suggestions.names && suggestions.names.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Pencil size={10} /> Name Suggestions
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {suggestions.names.map((n, i) => (
                            <div key={i} style={{
                              padding: '8px 10px', borderRadius: '6px', backgroundColor: t.surfaceEl,
                              border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: t.tp, marginBottom: '2px' }}>{n.name}</div>
                                <div style={{ fontSize: '10px', color: t.tm, lineHeight: '1.4' }}>{n.reason}</div>
                              </div>
                              <button onClick={() => applyNameSuggestion(n.name)} disabled={renameSaving}
                                style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '4px', color: t.violet, cursor: 'pointer', padding: '3px 8px', fontSize: '10px', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <ArrowRight size={9} /> Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content Improvements */}
                    {suggestions.improvements && suggestions.improvements.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Lightbulb size={10} /> Content Improvements
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {suggestions.improvements.map((imp, i) => (
                            <div key={i} style={{
                              padding: '8px 10px', borderRadius: '6px', backgroundColor: t.surfaceEl,
                              border: `1px solid ${t.border}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: t.tp }}>{imp.title}</span>
                                <span style={{
                                  fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                  padding: '1px 6px', borderRadius: '100px',
                                  color: imp.priority === 'high' ? '#ef4444' : imp.priority === 'medium' ? '#f59e0b' : '#22c55e',
                                  backgroundColor: imp.priority === 'high' ? 'rgba(239,68,68,0.12)' : imp.priority === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                                }}>
                                  {imp.priority}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: t.ts, lineHeight: '1.5' }}>{imp.description}</div>
                              {imp.target_file && (
                                <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FileText size={9} /> {imp.target_file}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structure Suggestions */}
                    {suggestions.structure && suggestions.structure.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FolderTree size={10} /> Structure
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {suggestions.structure.map((s, i) => (
                            <div key={i} style={{
                              padding: '8px 10px', borderRadius: '6px', backgroundColor: t.surfaceEl,
                              border: `1px solid ${t.border}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{
                                  fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                  padding: '1px 6px', borderRadius: '100px', color: t.violet, backgroundColor: t.violetG,
                                }}>
                                  {s.action}
                                </span>
                                <span style={{ fontSize: '11px', color: t.tp, fontWeight: 500, fontFamily: t.mono }}>{s.target}</span>
                              </div>
                              <div style={{ fontSize: '11px', color: t.ts, lineHeight: '1.5' }}>{s.suggestion}</div>
                              {s.description && <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px', lineHeight: '1.4' }}>{s.description}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Quick action buttons */}
              <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: 'Names', type: 'names', icon: Pencil },
                    { label: 'Content', type: 'improvements', icon: Lightbulb },
                    { label: 'Structure', type: 'structure', icon: FolderTree },
                  ].map(btn => (
                    <button key={btn.type} onClick={() => loadSuggestions(btn.type)} disabled={suggestionsLoading || !conversationId}
                      style={{ flex: 1, padding: '5px', borderRadius: '4px', backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`, color: t.ts, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: (!conversationId || suggestionsLoading) ? 0.4 : 1 }}>
                      <btn.icon size={10} /> {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Chat messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {messages.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                    <Sparkles size={20} style={{ color: t.tm, marginBottom: '10px', opacity: 0.3 }} />
                    <div style={{ fontSize: '12px', color: t.ts, marginBottom: '14px' }}>Ask AI to help write skill content</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[
                        { label: 'Generate This File', action: handleGenerateFile, icon: Wand2 },
                        { label: 'Generate All Files', action: handleGenerateAll, icon: Sparkles },
                      ].map(btn => (
                        <button key={btn.label} onClick={btn.action} disabled={generating}
                          style={{ background: t.surfaceEl, border: `1px solid ${t.border}`, padding: '8px 10px', borderRadius: '6px', color: t.ts, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: generating ? 0.5 : 1 }}>
                          <btn.icon size={12} /> {generating ? 'Generating...' : btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <div key={i} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '9px', color: t.tm, marginBottom: '3px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                          {m.role}
                        </div>
                        <div style={{
                          padding: '8px 10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6',
                          backgroundColor: m.role === 'user' ? t.violetG : t.surfaceEl,
                          border: `1px solid ${m.role === 'user' ? 'rgba(139,92,246,0.15)' : t.border}`,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ fontSize: '11px', color: t.tm, padding: '8px', fontStyle: 'italic' }}>
                        Thinking...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Chat input */}
              <div style={{ padding: '10px 12px', borderTop: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button onClick={handleGenerateFile} disabled={generating || !currentFilePath}
                    style={{ flex: 1, padding: '5px', borderRadius: '4px', backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`, color: t.ts, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: (!currentFilePath || generating) ? 0.4 : 1 }}>
                    <Wand2 size={10} /> Generate File
                  </button>
                  <button onClick={handleGenerateAll} disabled={generating}
                    style={{ flex: 1, padding: '5px', borderRadius: '4px', backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`, color: t.ts, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: generating ? 0.4 : 1 }}>
                    <Sparkles size={10} /> Generate All
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '36px', fontSize: '12px' }}
                    placeholder="Ask AI for help..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={chatLoading}
                  />
                  <button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: chatInput.trim() ? t.violet : t.tm, cursor: 'pointer', display: 'flex' }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Slash Command Menu */}
      {slashMenu.visible && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setSlashMenu({ ...slashMenu, visible: false })} />
          <div style={{ position: 'fixed', left: slashMenu.x, top: slashMenu.y, zIndex: 100, backgroundColor: t.surfaceEl, border: `1px solid ${t.borderS}`, borderRadius: '8px', padding: '4px', width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '6px 10px', fontSize: '9px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Block Type</div>
            {BLOCK_TYPES.map(item => (
              <div key={item.id}
                onClick={() => changeBlockType(slashMenu.blockId, item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', color: t.ts, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <item.icon size={13} style={{ color: t.tm }} />
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}

      </div>{/* end flex row */}

      {/* Template Picker Modal */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ width: '580px', backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Choose a template</h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: t.ts }}>Start with a pre-built structure or blank slate</p>
              </div>
              {!isNewSkill && <button onClick={() => setShowTemplates(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>}
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
              {/* Blank option */}
              <div onClick={() => handleInitTemplate('blank')}
                style={{ padding: '14px', border: `1px dashed ${t.borderS}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.violet; e.currentTarget.style.borderStyle = 'solid'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderS; e.currentTarget.style.borderStyle = 'dashed'; }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Blank Skill</div>
                <div style={{ fontSize: '11px', color: t.ts, lineHeight: '1.4' }}>Start from scratch with just SKILL.md</div>
              </div>
              {/* Templates */}
              {(templates || []).map(temp => (
                <div key={temp.slug} onClick={() => handleInitTemplate(temp.slug)}
                  style={{ padding: '14px', border: `1px solid ${t.border}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.violet; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{temp.name}</div>
                  <div style={{ fontSize: '11px', color: t.ts, lineHeight: '1.4', marginBottom: '6px' }}>{temp.description || 'Pre-built skill structure'}</div>
                  <div style={{ fontSize: '10px', color: t.tm }}>{temp.totalFiles} files</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${t.border}`, backgroundColor: 'rgba(0,0,0,0.15)', textAlign: 'center' }}>
              <button onClick={() => isNewSkill ? navigate(linkToAgent ? `/agents/${linkToAgent}` : '/skills') : setShowTemplates(false)}
                style={{ background: 'none', border: 'none', color: t.tm, fontSize: '11px', cursor: 'pointer' }}>
                {isNewSkill ? 'Cancel and go back' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: t.danger, color: '#fff', padding: '8px 18px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 300, fontSize: '12px' }}>
          <AlertCircle size={14} />
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', marginLeft: '4px' }}><X size={12} /></button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .ai-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
