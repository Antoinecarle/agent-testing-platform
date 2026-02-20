// Agent Creator V3 — Conversations, vision chat, agent name editing
// Dependencies: framer-motion, lucide-react

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Link as LinkIcon, Send, X, FileCode, Plus,
  Trash2, Bot, User, Sparkles, Zap, CheckCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight, Palette, Type, Layout,
  Layers, Save, MessageSquare, Edit3, Check, Clock, Image, Maximize2,
  Code, GitBranch, Settings, Megaphone, BarChart3, Wrench, Workflow,
  FileText, Database, PenTool, Briefcase, Wand2
} from 'lucide-react';
import { api, apiStream } from '../api';

const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)',
  borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6',
  violetM: 'rgba(139,92,246,0.2)',
  violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5',
  ts: '#A1A1AA',
  tm: '#52525B',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  cyan: '#06b6d4',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

interface AgentTypeInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  welcomeMessage: string;
}

const TYPE_ICONS: Record<string, any> = {
  Palette, Code, GitBranch, Workflow, Settings, Megaphone, BarChart3, Wrench,
};

interface Conversation {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  design_brief?: any;
  generated_agent?: string;
  generation_status?: string;
  agent_type?: string;
}

interface Reference {
  id: string;
  type: 'image' | 'url' | 'document';
  url?: string;
  filename?: string;
  analysis?: string;
  structured_analysis?: any;
  profile_image_url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Validation {
  valid: boolean;
  score: number;
  totalLines: number;
  sections: { name: string; found: boolean; required: boolean }[];
  issues: string[];
  stats: { cssVariables: number; codeBlocks: number; componentHeaders: number; checklistItems: number };
}

interface AgentCreatorProps {
  onClose: () => void;
  initialAgent?: { name: string; prompt: string; category?: string };
}

// Map agent DB category to agent_type for the creator system
const CATEGORY_TO_AGENT_TYPE: Record<string, string> = {
  'persona': 'persona',
  'landing pages': 'ux-design',
  'saas': 'ux-design',
  'creative': 'ux-design',
  'e-commerce': 'ux-design',
  'development': 'development',
  'orchestration': 'orchestration',
  'workflow': 'workflow',
  'operational': 'operational',
  'marketing': 'marketing',
  'data / ai': 'data-ai',
  'custom': 'custom',
};

const getWelcomeMsg = (welcomeText?: string): Message => ({
  id: 'welcome',
  role: 'assistant',
  content: welcomeText || "I'm your AI agent architect. I can see your uploaded screenshots directly — upload references and let's discuss the design.\n\nStart by uploading screenshots, adding URLs, or describing the style you want.",
});

const ENHANCE_WELCOME_MSG = (agentName: string): Message => ({
  id: 'welcome',
  role: 'assistant',
  content: `I've loaded the current prompt for **${agentName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}**. I'm ready to help you enhance it.\n\nTell me what you'd like to improve — capabilities, style, structure, new sections, or anything else.`,
});

const AgentCreator: React.FC<AgentCreatorProps> = ({ onClose, initialAgent }) => {
  // Agent types
  const [agentTypes, setAgentTypes] = useState<AgentTypeInfo[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [currentAgentType, setCurrentAgentType] = useState<string>('');

  // Conversation list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convName, setConvName] = useState('');
  const [editingConvName, setEditingConvName] = useState(false);
  const [convNameDraft, setConvNameDraft] = useState('');

  // Current conversation state
  const [references, setReferences] = useState<Reference[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatedAgent, setGeneratedAgent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [designBrief, setDesignBrief] = useState<any>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);
  const [refineSection, setRefineSection] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Document extraction mode
  const [extractionMode, setExtractionMode] = useState<string>('auto');
  const [showExtractionPicker, setShowExtractionPicker] = useState(false);

  // Preview image
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageStyle, setImageStyle] = useState<string>('auto');
  const [imageStyles, setImageStyles] = useState<{id:string, label:string, description:string, recommended:boolean}[]>([]);
  const [showImageStylePicker, setShowImageStylePicker] = useState(false);

  // Agent name editing (for save)
  const [agentNameOverride, setAgentNameOverride] = useState('');

  // Generation quality tiers
  const [generationQuality, setGenerationQuality] = useState<string>('standard');
  const [generationTiers, setGenerationTiers] = useState<{id:string, label:string, description:string, targetLines:{min:number,max:number}}[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationModel, setGenerationModel] = useState<string>('');
  const [showQualityPicker, setShowQualityPicker] = useState(false);

  // Readiness score
  const [readiness, setReadiness] = useState<{ score: number; status: string; statusLabel: string; breakdown: any[] }>({ score: 0, status: 'needs_input', statusLabel: '', breakdown: [] });
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const convNameInputRef = useRef<HTMLInputElement>(null);

  // Load agent types + generation tiers on mount
  useEffect(() => {
    api('/api/agent-creator/generation-tiers').then(res => {
      setGenerationTiers(res.tiers || []);
    }).catch(() => {});
    api('/api/agent-creator/types').then(res => {
      if (res.types) setAgentTypes(res.types);
    }).catch(() => {});
  }, []);

  // Load image styles when agent type changes
  useEffect(() => {
    api(`/api/agent-creator/image-styles?agent_type=${currentAgentType}`).then(res => {
      if (res.styles) setImageStyles(res.styles);
    }).catch(() => {});
    setImageStyle('auto'); // Reset to auto when type changes
  }, [currentAgentType]);

  // Load conversations on mount + auto-select last active (or init enhance mode)
  useEffect(() => {
    loadConversations().then(async (convs) => {
      // If initialAgent provided, create a new "Enhance" conversation
      if (initialAgent) {
        try {
          const displayName = initialAgent.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          // Detect agent_type from category — default to 'custom' for non-UX agents
          const detectedType = initialAgent.category
            ? (CATEGORY_TO_AGENT_TYPE[initialAgent.category.toLowerCase()] || 'custom')
            : 'custom';
          const result = await api('/api/agent-creator/conversations', {
            method: 'POST',
            body: JSON.stringify({ name: `Enhance: ${displayName}`, agent_type: detectedType, initial_agent: initialAgent.prompt || undefined }),
          });
          const conv = result.conversation;
          setConversations(prev => [conv, ...prev]);
          setConversationId(conv.id);
          setConvName(conv.name);
          localStorage.setItem('atp-agent-creator-conv', conv.id);
          setAgentNameOverride(initialAgent.name);
          // Set the existing prompt as the generated agent (so it shows in preview)
          if (initialAgent.prompt) {
            setGeneratedAgent(initialAgent.prompt);
            setIsPreviewOpen(true);
          }
          setMessages([ENHANCE_WELCOME_MSG(initialAgent.name)]);
          setReferences([]);
          // Send a system context message so the AI knows the current prompt
          if (initialAgent.prompt) {
            try {
              const contextMsg = `I want to enhance this existing agent "${displayName}". Here is its current prompt:\n\n\`\`\`\n${initialAgent.prompt.slice(0, 8000)}\n\`\`\`\n\nPlease analyze it and wait for my instructions on what to improve.`;
              const result2 = await api(`/api/agent-creator/conversations/${conv.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({ message: contextMsg }),
              });
              // Add both user and assistant messages to the chat
              const userMsg: Message = { id: `init-${Date.now()}`, role: 'user', content: contextMsg };
              const responseContent = result2.message?.content || result2.response || '';
              const assistantMsg: Message = { id: `resp-${Date.now()}`, role: 'assistant', content: responseContent };
              setMessages(prev => [...prev, userMsg, assistantMsg]);
            } catch (err: any) {
              console.error('Failed to send initial context:', err);
            }
          }
          return;
        } catch (err: any) {
          console.error('Failed to create enhance conversation:', err);
        }
      }

      if (!convs || convs.length === 0) return;
      const savedId = localStorage.getItem('atp-agent-creator-conv');
      const target = savedId ? convs.find((c: Conversation) => c.id === savedId) : null;
      selectConversation(target || convs[0]);
    });
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (editingConvName && convNameInputRef.current) convNameInputRef.current.focus();
  }, [editingConvName]);

  const loadConversations = async (): Promise<Conversation[]> => {
    try {
      const result = await api('/api/agent-creator/conversations');
      const convs = result.conversations || [];
      setConversations(convs);
      return convs;
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      return [];
    }
  };

  const createConversation = async (name?: string, agentType?: string) => {
    try {
      if (!agentType) {
        console.warn('[AgentCreator] No agent type specified for new conversation');
        return;
      }
      const result = await api('/api/agent-creator/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: name || 'New Agent', agent_type: agentType }),
      });
      const conv = result.conversation;
      setConversations(prev => [conv, ...prev]);
      setShowTypeSelector(false);
      selectConversation(conv);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    setConvName(conv.name);
    setCurrentAgentType(conv.agent_type || 'custom');
    localStorage.setItem('atp-agent-creator-conv', conv.id);
    setEditingConvName(false);
    setDesignBrief(null);
    setGeneratedAgent('');
    setValidation(null);
    setIsPreviewOpen(false);
    setRefineSection(null);
    setAgentNameOverride('');
    setPreviewImageUrl(null);
    setShowImageModal(false);
    setShowTypeSelector(false);

    // Load full conversation data
    try {
      const result = await api(`/api/agent-creator/conversations/${conv.id}`);
      const c = result.conversation;
      const convType = c.agent_type || 'custom';
      setCurrentAgentType(convType);
      const msgs: Message[] = (c.messages || []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
      }));
      // Type-aware welcome message
      const typeInfo = agentTypes.find(t => t.id === convType);
      const welcomeMsg = conv.name.startsWith('Enhance:')
        ? ENHANCE_WELCOME_MSG(conv.name.replace('Enhance: ', ''))
        : getWelcomeMsg(typeInfo?.welcomeMessage);
      setMessages(msgs.length > 0 ? msgs : [welcomeMsg]);
      setReferences(c.references || []);
      if (c.design_brief) setDesignBrief(c.design_brief);
      if (c.generated_agent) {
        setGeneratedAgent(c.generated_agent);
        setIsPreviewOpen(true);
        const nameMatch = c.generated_agent.match(/^name:\s*(.+)$/m);
        if (nameMatch) setAgentNameOverride(nameMatch[1].trim());
      }
      // Load readiness score for the conversation
      fetchReadiness();
      const previewCheckUrl = `/uploads/agent-creator/preview-${conv.id}.png`;
      fetch(previewCheckUrl, { method: 'HEAD' }).then(r => {
        if (r.ok) setPreviewImageUrl(previewCheckUrl + '?t=' + Date.now());
      }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      // If conversation no longer exists, remove it from the list
      if (err.message?.includes('not found') || err.message?.includes('Not found')) {
        setConversations(prev => prev.filter(c => c.id !== conv.id));
        setConversationId(null);
        localStorage.removeItem('atp-agent-creator-conv');
      }
      setMessages([getWelcomeMsg()]);
      setReferences([]);
    }
  };

  const renameConversation = async () => {
    if (!conversationId || !convNameDraft.trim()) return;
    try {
      await api(`/api/agent-creator/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: convNameDraft.trim() }),
      });
      setConvName(convNameDraft.trim());
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, name: convNameDraft.trim() } : c));
      setEditingConvName(false);
    } catch (err: any) {
      console.error('Failed to rename:', err);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api(`/api/agent-creator/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setReferences([]);
        setDesignBrief(null);
        setGeneratedAgent('');
        localStorage.removeItem('atp-agent-creator-conv');
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !conversationId || addingUrl) return;
    setAddingUrl(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/urls`, {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setReferences(prev => [...prev, result.reference]);
      fetchReadiness();
      // Show profile image notification in chat if detected
      const profileImg = result.reference.profile_image_url || result.reference.structured_analysis?.profile_image_url;
      if (profileImg) {
        setMessages(prev => [...prev, {
          id: `profile-${Date.now()}`,
          role: 'assistant' as const,
          content: `![Profile Picture](${profileImg})\n\nI found and saved the profile picture from this URL. It will be used as the agent's avatar.`,
        }]);
        // If in enhance mode, immediately update the agent's screenshot
        if (initialAgent) {
          try {
            await api(`/api/agents/${initialAgent.name}/screenshot`, {
              method: 'PATCH',
              body: JSON.stringify({ screenshot_path: profileImg }),
            });
          } catch (err: any) {
            console.warn('Failed to update agent screenshot:', err);
          }
        }
      }
      setUrlInput('');
    } catch (err: any) {
      console.error('Failed to add URL:', err);
    } finally {
      setAddingUrl(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !conversationId) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('image', files[i]);
        const res = await fetch(`/api/agent-creator/conversations/${conversationId}/images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('atp-token')}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Upload failed');
        }
        const result = await res.json();
        setReferences(prev => [...prev, result.reference]);
      fetchReadiness();
      }
    } catch (err: any) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !conversationId) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('document', files[i]);
        formData.append('extraction_mode', extractionMode);
        const res = await fetch(`/api/agent-creator/conversations/${conversationId}/documents`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('atp-token')}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Upload failed');
        }
        const result = await res.json();
        setReferences(prev => [...prev, result.reference]);
      fetchReadiness();
      }
    } catch (err: any) {
      console.error('Failed to upload document:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeReference = async (id: string) => {
    if (!conversationId) return;
    try {
      await api(`/api/agent-creator/conversations/${conversationId}/references/${id}`, { method: 'DELETE' });
      setReferences(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Failed to remove reference:', err);
    }
  };

  // Fetch readiness score
  const fetchReadiness = useCallback(async () => {
    if (!conversationId) return;
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/readiness`);
      setReadiness(result);
    } catch (err) {
      // Silent fail
    }
  }, [conversationId]);

  // Auto-generate when readiness is high enough
  useEffect(() => {
    if (readiness.score >= 75 && !autoGenerateTriggered && !isGenerating && !generatedAgent && conversationId) {
      const userMsgCount = messages.filter(m => m.role === 'user' && m.id !== 'welcome').length;
      if (userMsgCount >= 1) {
        setAutoGenerateTriggered(true);
        // Small delay to let the UI update with the score first
        const timer = setTimeout(() => {
          generateAgentRef.current?.();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [readiness.score, autoGenerateTriggered, isGenerating, generatedAgent, conversationId, messages]);

  // Reset auto-generate flag when conversation changes
  useEffect(() => {
    setAutoGenerateTriggered(false);
  }, [conversationId]);

  const generateAgentRef = useRef<(() => void) | null>(null);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || isSending) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: inputMessage };
    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMessage]);
    setInputMessage('');
    setIsSending(true);

    // Add a placeholder streaming message
    const streamId = `stream-${Date.now()}`;
    let streamContent = '';
    setMessages(prev => [...prev, { id: streamId, role: 'assistant', content: '' }]);

    try {
      await apiStream(
        `/api/agent-creator/conversations/${conversationId}/messages`,
        { message: userMessage.content },
        {
          onStatus: (msg: string) => {
            // Update placeholder with status while waiting for first chunk
            if (!streamContent) {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: '' } : m));
            }
          },
          onChunk: (text: string) => {
            streamContent += text;
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: streamContent } : m));
          },
          onDone: (data: any) => {
            // Replace stream ID with real message ID from DB
            if (data.messageId) {
              setMessages(prev => prev.map(m => m.id === streamId ? { ...m, id: data.messageId } : m));
            }
            // Refresh readiness score after each assistant response
            fetchReadiness();
          },
          onError: (msg: string) => {
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: `Error: ${msg}` } : m));
          },
        }
      );
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: `Error: ${err.message || 'Failed'}` } : m));
    } finally {
      setIsSending(false);
    }
  };

  const analyzeReferences = async () => {
    if (!conversationId || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/analyze`, { method: 'POST' });
      setDesignBrief(result.brief);
      // Build type-aware brief message
      const brief = result.brief;
      const isUX = currentAgentType === 'ux-design';
      let briefContent = '';
      if (isUX) {
        briefContent = `Design Brief synthesized from ${references.length} reference(s):\n\n` +
          `**Aesthetic**: ${brief.agentIdentity?.aesthetic || 'custom'}\n` +
          `**Colors**: ${Object.keys(brief.colorSystem?.cssVariables || {}).length} CSS variables\n` +
          `**Fonts**: ${brief.typographySystem?.displayFont || '?'} + ${brief.typographySystem?.bodyFont || '?'}\n` +
          `**Components**: ${(brief.componentInventory || []).map((c: any) => c.name).join(', ')}\n\n` +
          `Ready to generate. Click **Generate Agent**.`;
      } else {
        briefContent = `Agent Brief synthesized:\n\n` +
          `**Role**: ${brief.agentIdentity?.role || 'specialist'}\n` +
          `**Expertise**: ${(brief.agentIdentity?.expertise || []).slice(0, 4).join(', ') || '?'}\n` +
          `**Capabilities**: ${(brief.capabilities || []).map((c: any) => c.name).join(', ') || '?'}\n` +
          `**Tools**: ${(brief.toolConfiguration?.primaryTools || []).join(', ') || 'standard'}\n\n` +
          `Ready to generate. Click **Generate Agent**.`;
      }
      setMessages(prev => [...prev, {
        id: `brief-${Date.now()}`,
        role: 'assistant',
        content: briefContent,
      }]);
    } catch (err: any) {
      console.error('Failed to analyze:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAgent = async () => {
    if (!conversationId || isGenerating) return;
    setIsGenerating(true);
    setIsPreviewOpen(true);
    setGeneratedAgent('');
    setValidation(null);
    setGenerationStatus('Preparing...');
    setGenerationModel('');

    let content = '';
    try {
      await apiStream(
        `/api/agent-creator/conversations/${conversationId}/generate`,
        { quality: generationQuality },
        {
          onStatus: (msg: string, data: any) => {
            setGenerationStatus(msg);
            if (data?.model) setGenerationModel(data.model);
          },
          onChunk: (text: string) => {
            content += text;
            setGeneratedAgent(content);
          },
          onDone: (data: any) => {
            setValidation(data.validation);
            setGenerationStatus('');
            // Extract agent name from frontmatter
            const nameMatch = content.match(/^name:\s*(.+)$/m);
            if (nameMatch) setAgentNameOverride(nameMatch[1].trim());
          },
          onError: (msg: string) => {
            setGeneratedAgent(`# Error generating agent\n\n${msg}`);
            setGenerationStatus('');
          },
        }
      );
    } catch (err: any) {
      console.error('Failed to generate:', err);
      setGeneratedAgent(`# Error generating agent\n\n${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  // Keep ref in sync for auto-generate
  generateAgentRef.current = generateAgent;

  const handleRefine = async () => {
    if (!conversationId || !refineSection || !refineFeedback.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/refine`, {
        method: 'POST',
        body: JSON.stringify({ section: refineSection, feedback: refineFeedback }),
      });
      setGeneratedAgent(result.agentFile);
      setValidation(result.validation);
      setRefineSection(null);
      setRefineFeedback('');
    } catch (err: any) {
      console.error('Failed to refine:', err);
    } finally {
      setIsRefining(false);
    }
  };

  const generatePreviewImage = async () => {
    if (!conversationId || isGeneratingPreview) return;
    setIsGeneratingPreview(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/preview-image`, {
        method: 'POST',
        body: JSON.stringify({ image_style: imageStyle }),
      });
      setPreviewImageUrl(result.previewUrl + '?t=' + Date.now());
    } catch (err: any) {
      console.error('Failed to generate preview:', err);
      alert(`Preview failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const saveAgent = async () => {
    if (!conversationId || !generatedAgent || isSaving) return;
    setIsSaving(true);
    try {
      // If user edited the agent name, replace it in the frontmatter
      let content = generatedAgent;
      if (agentNameOverride.trim()) {
        content = content.replace(/^name:\s*.+$/m, `name: ${agentNameOverride.trim()}`);
      }
      const result = await api(`/api/agent-creator/conversations/${conversationId}/save`, {
        method: 'POST',
        body: JSON.stringify({ agentContent: content }),
      });
      if (result.success) {
        alert(`Agent "${result.agent.name}" saved to library!`);
        onClose();
      }
    } catch (err: any) {
      alert(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Extract section headers from generated agent for TOC
  const agentSections = generatedAgent
    ? (generatedAgent.match(/^## .+$/gm) || []).map(h => h.replace('## ', ''))
    : [];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div style={{ backgroundColor: t.bg, color: t.tp, position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '10px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.violetM}` }}>
            <Bot size={18} color={t.violet} />
          </div>
          <div>
            {conversationId && !editingConvName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{convName}</h1>
                <button onClick={() => { setEditingConvName(true); setConvNameDraft(convName); }}
                  style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px' }}>
                  <Edit3 size={12} />
                </button>
              </div>
            ) : conversationId && editingConvName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input ref={convNameInputRef} type="text" value={convNameDraft} onChange={e => setConvNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameConversation(); if (e.key === 'Escape') setEditingConvName(false); }}
                  style={{ background: t.bg, border: `1px solid ${t.violet}`, borderRadius: '4px', padding: '2px 8px', color: t.tp, fontSize: '14px', fontWeight: 600, outline: 'none', width: '200px' }}
                />
                <button onClick={renameConversation} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', padding: '2px' }}>
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingConvName(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Agent Architect</h1>
            )}
            <span style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {conversationId ? (
                <>
                  {(() => {
                    const ti = agentTypes.find(at => at.id === currentAgentType);
                    return ti ? (
                      <span style={{ fontSize: '10px', color: ti.color, padding: '1px 6px', background: `${ti.color}15`, borderRadius: '4px', fontWeight: 600 }}>
                        {ti.label}
                      </span>
                    ) : null;
                  })()}
                  {references.length} refs | {messages.filter(m => m.id !== 'welcome').length} msgs
                </>
              ) : 'Select or create a conversation'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {validation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: validation.score >= 7 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${validation.score >= 7 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              {validation.score >= 7 ? <CheckCircle size={14} color={t.success} /> : <AlertTriangle size={14} color={t.warning} />}
              <span style={{ fontSize: '12px', fontWeight: 600, color: validation.score >= 7 ? t.success : t.warning }}>
                {validation.score}/10 | {validation.totalLines} lines
              </span>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', padding: '6px', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isPreviewOpen ? '220px 260px 1fr 420px' : '220px 260px 1fr', overflow: 'hidden', minHeight: 0 }}>

        {/* FAR LEFT: Conversation List */}
        <aside style={{ borderRight: `1px solid ${t.border}`, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}` }}>
            <button onClick={() => setShowTypeSelector(true)}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                background: t.violetG, color: t.violet, border: `1px solid ${t.violetM}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
              <Plus size={14} /> New Agent
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                No conversations yet.<br />Click "New" to start.
              </div>
            )}
            {conversations.map(conv => (
              <div key={conv.id}
                onClick={() => selectConversation(conv)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                  background: conv.id === conversationId ? t.surfaceEl : 'transparent',
                  borderLeft: conv.id === conversationId ? `2px solid ${t.violet}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: conv.id === conversationId ? t.tp : t.ts, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '10px', color: t.tm, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} /> {timeAgo(conv.updated_at || conv.created_at)}
                      </span>
                      {conv.agent_type && (() => {
                        const ti = agentTypes.find(at => at.id === conv.agent_type);
                        return ti ? (
                          <span style={{ fontSize: '8px', color: ti.color, padding: '0 4px', background: `${ti.color}15`, borderRadius: '3px' }}>
                            {ti.label}
                          </span>
                        ) : null;
                      })()}
                      {conv.generation_status === 'complete' && (
                        <span style={{ fontSize: '9px', color: t.success, padding: '0 4px', background: 'rgba(34,197,94,0.1)', borderRadius: '3px' }}>generated</span>
                      )}
                      {conv.generation_status === 'analyzing' && (
                        <span style={{ fontSize: '9px', color: t.cyan, padding: '0 4px', background: 'rgba(6,182,212,0.1)', borderRadius: '3px' }}>analyzing</span>
                      )}
                      {conv.generation_status === 'briefing' && (
                        <span style={{ fontSize: '9px', color: t.cyan, padding: '0 4px', background: 'rgba(6,182,212,0.1)', borderRadius: '3px' }}>briefing</span>
                      )}
                      {conv.generation_status === 'generating' && (
                        <span style={{ fontSize: '9px', color: t.warning, padding: '0 4px', background: 'rgba(245,158,11,0.1)', borderRadius: '3px' }}>generating</span>
                      )}
                      {conv.generation_status === 'error' && (
                        <span style={{ fontSize: '9px', color: t.danger, padding: '0 4px', background: 'rgba(239,68,68,0.1)', borderRadius: '3px' }}>error</span>
                      )}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', opacity: 0.5, flexShrink: 0 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* LEFT: References Sidebar */}
        <aside style={{ borderRight: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px', overflowY: 'auto', minHeight: 0 }}>
          {!conversationId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: '12px', textAlign: 'center', padding: '20px' }}>
              Select or create a conversation to start
            </div>
          ) : (
            <>
              <div>
                <h3 style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>References</h3>

                {/* Upload buttons — images + documents */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '12px 6px', border: `1px dashed ${t.borderS}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: t.bg }}>
                    <UploadCloud size={16} color={isUploading ? t.violet : t.ts} />
                    <span style={{ fontSize: '10px', color: t.ts }}>{isUploading ? 'Analyzing...' : 'Images'}</span>
                    <input type="file" hidden onChange={handleImageUpload} accept="image/*" multiple disabled={isUploading} />
                  </label>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '12px 6px', border: `1px dashed ${t.borderS}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: t.bg }}>
                    <FileText size={16} color={isUploading ? t.violet : t.ts} />
                    <span style={{ fontSize: '10px', color: t.ts }}>{isUploading ? 'Analyzing...' : 'Docs'}</span>
                    <input type="file" hidden onChange={handleDocumentUpload} accept=".pdf,.md,.txt,.json,.yaml,.yml,.csv" multiple disabled={isUploading} />
                  </label>
                </div>

                {/* Extraction mode picker */}
                <div style={{ marginTop: '6px', position: 'relative' }}>
                  <button
                    onClick={() => setShowExtractionPicker(!showExtractionPicker)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 8px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
                      color: t.ts, fontSize: '10px', cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {extractionMode === 'auto' && <><Wand2 size={10} /> Auto</>}
                      {extractionMode === 'general' && <><FileText size={10} /> General</>}
                      {extractionMode === 'ux-design' && <><Palette size={10} /> UX / Design</>}
                      {extractionMode === 'data' && <><Database size={10} /> Data / API</>}
                      {extractionMode === 'content' && <><PenTool size={10} /> Content / SEO</>}
                      {extractionMode === 'technical' && <><Code size={10} /> Technical</>}
                      {extractionMode === 'business' && <><Briefcase size={10} /> Business</>}
                    </span>
                    <ChevronDown size={10} style={{ transform: showExtractionPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                  {showExtractionPicker && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      marginTop: '2px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                      borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}>
                      {[
                        { id: 'auto', label: 'Auto', icon: Wand2, desc: 'Detect from agent type', color: t.violet },
                        { id: 'ux-design', label: 'UX / Design', icon: Palette, desc: 'Colors, typo, layout, components', color: '#EC4899' },
                        { id: 'data', label: 'Data / API', icon: Database, desc: 'Models, schemas, endpoints', color: '#3B82F6' },
                        { id: 'content', label: 'Content / SEO', icon: PenTool, desc: 'Tone, voice, editorial rules', color: '#F59E0B' },
                        { id: 'technical', label: 'Technical', icon: Code, desc: 'Architecture, stack, patterns', color: '#10B981' },
                        { id: 'business', label: 'Business', icon: Briefcase, desc: 'Rules, processes, KPIs', color: '#8B5CF6' },
                        { id: 'general', label: 'General', icon: FileText, desc: 'Generic extraction', color: t.ts },
                      ].map(mode => {
                        const Icon = mode.icon;
                        const isActive = extractionMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => { setExtractionMode(mode.id); setShowExtractionPicker(false); }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '7px 10px', border: 'none', cursor: 'pointer', textAlign: 'left',
                              background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                              borderLeft: isActive ? `2px solid ${t.violet}` : '2px solid transparent',
                            }}
                          >
                            <Icon size={12} color={mode.color} />
                            <div>
                              <div style={{ fontSize: '10px', color: isActive ? t.tp : t.ts, fontWeight: isActive ? 600 : 400 }}>{mode.label}</div>
                              <div style={{ fontSize: '8px', color: t.tm }}>{mode.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* URL */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <LinkIcon size={11} color={t.tm} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" placeholder="URL..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                      style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '7px 8px 7px 26px', color: t.tp, fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                  <button onClick={addUrl} disabled={addingUrl} style={{ padding: '7px', borderRadius: '6px', background: t.violet, border: 'none', color: 'white', cursor: 'pointer' }}>
                    {addingUrl ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  </button>
                </div>
              </div>

              {/* Reference List */}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 700 }}>
                  Context ({references.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {references.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: t.tm, fontSize: '11px' }}>No references yet</div>}
                  <AnimatePresence initial={false}>
                    {references.map((ref) => (
                      <motion.div key={ref.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{ padding: '6px', background: t.surfaceEl, borderRadius: '6px', border: `1px solid ${ref.structured_analysis ? 'rgba(34,197,94,0.15)' : t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {ref.type === 'image' || ref.profile_image_url || ref.structured_analysis?.profile_image_url ? (
                            <div style={{ width: '24px', height: '24px', borderRadius: ref.profile_image_url || ref.structured_analysis?.profile_image_url ? '50%' : '3px', overflow: 'hidden', background: t.bg, flexShrink: 0 }}>
                              <img src={ref.type === 'image' ? ref.url : (ref.profile_image_url || ref.structured_analysis?.profile_image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : ref.type === 'document' ? (
                            <div style={{ width: '24px', height: '24px', borderRadius: '3px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={10} color={t.violet} />
                            </div>
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '3px', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <LinkIcon size={10} color={t.ts} />
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <p style={{ fontSize: '10px', color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                              {ref.filename || ref.url}
                            </p>
                            {ref.structured_analysis && (
                              <span style={{ fontSize: '9px', color: t.success, display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px' }}>
                                <CheckCircle size={8} /> Analyzed
                              </span>
                            )}
                          </div>
                          <button onClick={() => removeReference(ref.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '2px' }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                        {/* Profile image preview for URL references (LinkedIn etc.) */}
                        {ref.type === 'url' && (ref.profile_image_url || ref.structured_analysis?.profile_image_url) && (
                          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img
                              src={ref.profile_image_url || ref.structured_analysis?.profile_image_url}
                              alt="Profile"
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${t.violet}` }}
                            />
                            <span style={{ fontSize: '9px', color: t.success, display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <CheckCircle size={8} /> Profile pic saved
                            </span>
                          </div>
                        )}
                        {ref.structured_analysis && ref.type === 'image' && ref.structured_analysis.colors && (
                          <div style={{ marginTop: '4px', display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                            {[ref.structured_analysis.colors.dominantBackground, ref.structured_analysis.colors.primaryAccent, ref.structured_analysis.colors.secondaryAccent]
                              .filter(Boolean).map((color: string, i: number) => (
                                <div key={i} style={{ width: '14px', height: '14px', borderRadius: '2px', background: color, border: '1px solid rgba(255,255,255,0.1)' }} title={color} />
                              ))}
                            {ref.structured_analysis.components?.overallAesthetic && (
                              <span style={{ fontSize: '8px', color: t.tm, padding: '1px 4px', background: t.bg, borderRadius: '2px', marginLeft: '2px' }}>
                                {ref.structured_analysis.components.overallAesthetic}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Content URL analysis preview */}
                        {ref.structured_analysis?.gptAnalysis?.keyInsights && (
                          <div style={{ marginTop: '4px', fontSize: '9px', color: t.ts, lineHeight: '1.4' }}>
                            {ref.structured_analysis.gptAnalysis.sourceType && (
                              <span style={{ fontSize: '8px', color: t.cyan, padding: '1px 4px', background: 'rgba(6,182,212,0.1)', borderRadius: '2px', marginRight: '4px' }}>
                                {ref.structured_analysis.gptAnalysis.sourceType}
                              </span>
                            )}
                            {ref.structured_analysis.gptAnalysis.keyInsights.slice(0, 2).map((insight: string, i: number) => (
                              <div key={i} style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {insight.slice(0, 60)}{insight.length > 60 ? '...' : ''}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Document analysis preview */}
                        {ref.type === 'document' && ref.structured_analysis?.gptAnalysis && (
                          <div style={{ marginTop: '4px', fontSize: '9px', color: t.ts, lineHeight: '1.4' }}>
                            {ref.structured_analysis.extractionMode && (
                              <span style={{ fontSize: '8px', color: '#10B981', padding: '1px 4px', background: 'rgba(16,185,129,0.1)', borderRadius: '2px', marginRight: '4px' }}>
                                {ref.structured_analysis.extractionMode}
                              </span>
                            )}
                            {ref.structured_analysis.gptAnalysis.documentType && (
                              <span style={{ fontSize: '8px', color: t.violet, padding: '1px 4px', background: 'rgba(139,92,246,0.1)', borderRadius: '2px', marginRight: '4px' }}>
                                {ref.structured_analysis.gptAnalysis.documentType}
                              </span>
                            )}
                            {ref.structured_analysis.gptAnalysis.summary && (
                              <div style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ref.structured_analysis.gptAnalysis.summary.slice(0, 80)}...
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Analyze Button */}
              {references.length > 0 && (
                <button onClick={analyzeReferences} disabled={isAnalyzing}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '6px', fontWeight: 600, fontSize: '11px', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    background: designBrief ? 'rgba(34,197,94,0.1)' : t.violetG,
                    color: designBrief ? t.success : t.violet,
                    border: `1px solid ${designBrief ? 'rgba(34,197,94,0.2)' : t.violetM}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  }}>
                  {isAnalyzing ? <><RefreshCw size={12} /> Synthesizing...</> :
                    designBrief ? <><CheckCircle size={12} /> Brief ready</> :
                      <><Zap size={12} /> Analyze & Brief</>}
                </button>
              )}

              {/* Brief Summary */}
              {designBrief && (
                <div style={{ padding: '8px', borderRadius: '6px', background: t.bg, border: `1px solid ${t.border}`, fontSize: '10px' }}>
                  <div style={{ color: t.tm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontSize: '9px' }}>Brief</div>
                  <div style={{ color: t.ts, lineHeight: '1.5' }}>
                    {currentAgentType === 'ux-design' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Palette size={9} color={t.cyan} />
                          {Object.keys(designBrief.colorSystem?.cssVariables || {}).length} CSS vars
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Type size={9} color={t.cyan} />
                          {designBrief.typographySystem?.displayFont || '?'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Layout size={9} color={t.cyan} />
                          {designBrief.layoutArchitecture?.primaryLayout || '?'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Layers size={9} color={t.cyan} />
                          {(designBrief.componentInventory || []).length} comps
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Bot size={9} color={t.cyan} />
                          {designBrief.agentIdentity?.role?.slice(0, 40) || 'specialist'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Layers size={9} color={t.cyan} />
                          {(designBrief.capabilities || []).length} capabilities
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                          <Settings size={9} color={t.cyan} />
                          {(designBrief.toolConfiguration?.primaryTools || []).length} tools
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle size={9} color={t.cyan} />
                          {(designBrief.qualityCriteria || []).length} quality rules
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* CENTER: Chat or Type Selector */}
        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {showTypeSelector || !conversationId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: `1px solid ${t.violetM}` }}>
                  <Sparkles size={24} color={t.violet} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: t.tp, margin: '0 0 6px' }}>Create a New Agent</h2>
                <p style={{ fontSize: '13px', color: t.ts, margin: 0 }}>Choose the type of agent you want to craft</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxWidth: '520px', width: '100%' }}>
                {agentTypes.map(at => {
                  const Icon = TYPE_ICONS[at.icon] || Bot;
                  return (
                    <motion.button key={at.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => createConversation(`New ${at.label} Agent`, at.id)}
                      style={{
                        padding: '16px', borderRadius: '12px', background: t.surface,
                        border: `1px solid ${at.color}30`, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        transition: '0.2s', boxShadow: `0 0 20px ${at.color}08`,
                      }}>
                      <div style={{
                        padding: '8px', borderRadius: '8px', background: `${at.color}18`,
                        color: at.color, flexShrink: 0, boxShadow: `0 0 12px ${at.color}20`,
                      }}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: t.tp, marginBottom: '3px' }}>{at.label}</div>
                        <div style={{ fontSize: '11px', color: t.ts, lineHeight: '1.4' }}>{at.description}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {showTypeSelector && conversationId && (
                <button onClick={() => setShowTypeSelector(false)}
                  style={{ marginTop: '16px', padding: '6px 16px', borderRadius: '6px', background: t.surfaceEl, border: `1px solid ${t.border}`, color: t.ts, fontSize: '12px', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 6%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: '10px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: msg.role === 'user' ? t.surfaceEl : t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${msg.role === 'user' ? t.border : t.violetM}` }}>
                      {msg.role === 'user' ? <User size={12} color={t.ts} /> : <Sparkles size={12} color={t.violet} />}
                    </div>
                    <div style={{
                      background: msg.role === 'user' ? t.violet : t.surfaceEl, padding: '9px 13px', borderRadius: '12px',
                      borderTopRightRadius: msg.role === 'user' ? '3px' : '12px', borderTopLeftRadius: msg.role === 'assistant' ? '3px' : '12px',
                      color: msg.role === 'user' ? 'white' : t.tp, fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content ? msg.content.split(/(\!\[.*?\]\(.*?\))/).map((part: string, i: number) => {
                        const imgMatch = part.match(/^\!\[(.*?)\]\((.*?)\)$/);
                        if (imgMatch) {
                          return <img key={i} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '120px', borderRadius: '12px', display: 'block', margin: '4px 0', border: `2px solid ${t.violet}40` }} />;
                        }
                        return <span key={i}>{part}</span>;
                      }) : null}
                      {isSending && msg.id.startsWith('stream-') && (
                        <span style={{ display: 'inline-block', width: '5px', height: '13px', background: t.violet, marginLeft: '1px', verticalAlign: 'text-bottom', animation: 'blink 0.7s step-end infinite' }} />
                      )}
                    </div>
                  </motion.div>
                ))}
                {isSending && !messages.some(m => m.id.startsWith('stream-') && m.content) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '10px', maxWidth: '85%', alignSelf: 'flex-start' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={12} color={t.violet} />
                    </div>
                    <div style={{ background: t.surfaceEl, padding: '9px 13px', borderRadius: '12px', borderTopLeftRadius: '3px', color: t.tm, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: t.violet, animation: 'blink 1s infinite' }} />
                      <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: t.violet, animation: 'blink 1s infinite 0.2s' }} />
                      <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: t.violet, animation: 'blink 1s infinite 0.4s' }} />
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input + Actions */}
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, background: t.bg }}>
                <div style={{ maxWidth: '680px', margin: '0 auto', background: t.surface, borderRadius: '10px', border: `1px solid ${t.borderS}`, padding: '3px' }}>
                  <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Describe the design, ask about your screenshots..." disabled={isSending}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: t.tp, padding: '8px 10px', height: '48px', resize: 'none', outline: 'none', fontSize: '13px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {references.length > 0 && (
                        <span style={{ fontSize: '10px', color: t.tm, display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', background: t.bg, borderRadius: '4px' }}>
                          <UploadCloud size={10} />
                          {references.filter(r => r.type === 'image').length > 0 && `${references.filter(r => r.type === 'image').length} img`}
                          {references.filter(r => r.type === 'url').length > 0 && ` ${references.filter(r => r.type === 'url').length} url`}
                          {references.filter(r => r.type === 'document').length > 0 && ` ${references.filter(r => r.type === 'document').length} doc`}
                        </span>
                      )}
                      {/* Readiness gauge */}
                      {conversationId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px', background: t.bg, borderRadius: '6px', border: `1px solid ${t.border}` }} title={readiness.statusLabel || 'Agent readiness'}>
                          <svg width="18" height="18" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke={t.border} strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.5" fill="none"
                              stroke={readiness.score < 40 ? t.danger : readiness.score < 65 ? t.warning : readiness.score < 85 ? t.success : '#4ade80'}
                              strokeWidth="3" strokeDasharray={`${readiness.score * 0.9738} 97.38`}
                              strokeLinecap="round" transform="rotate(-90 18 18)"
                              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
                            />
                            <text x="18" y="19.5" textAnchor="middle" dominantBaseline="middle" fill={readiness.score < 40 ? t.danger : readiness.score < 65 ? t.warning : readiness.score < 85 ? t.success : '#4ade80'}
                              style={{ fontSize: '10px', fontWeight: 700, fontFamily: t.mono }}>
                              {readiness.score}
                            </text>
                          </svg>
                          <span style={{ fontSize: '9px', color: readiness.score < 40 ? t.tm : readiness.score < 65 ? t.warning : t.success, fontWeight: 500, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {readiness.score >= 85 ? 'Ready' : readiness.score >= 65 ? 'Good' : readiness.score >= 40 ? 'Fair' : 'More info'}
                          </span>
                        </div>
                      )}
                      {/* Quality tier selector */}
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowQualityPicker(!showQualityPicker)} disabled={isGenerating}
                          style={{
                            background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '4px 8px',
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: t.tm,
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                          }}>
                          <Zap size={9} color={generationQuality === 'fast' ? '#22c55e' : generationQuality === 'full' ? '#f59e0b' : t.violet} />
                          {generationTiers.find(t => t.id === generationQuality)?.label || 'Standard'}
                          <ChevronDown size={9} />
                        </button>
                        {showQualityPicker && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', background: t.surface, border: `1px solid ${t.border}`,
                            borderRadius: '8px', padding: '4px', minWidth: '200px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                          }}>
                            {generationTiers.map(tier => (
                              <button key={tier.id}
                                onClick={() => { setGenerationQuality(tier.id); setShowQualityPicker(false); }}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: tier.id === generationQuality ? t.surfaceEl : 'transparent',
                                  border: 'none', borderRadius: '6px', cursor: 'pointer', color: t.tp,
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                                  <Zap size={10} color={tier.id === 'fast' ? '#22c55e' : tier.id === 'full' ? '#f59e0b' : t.violet} />
                                  {tier.label}
                                  <span style={{ fontSize: '9px', color: t.tm, fontWeight: 400 }}>
                                    {tier.targetLines.min}-{tier.targetLines.max}L
                                  </span>
                                </div>
                                <div style={{ fontSize: '9px', color: t.tm, marginTop: '2px', paddingLeft: '16px' }}>
                                  {tier.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={generateAgent} disabled={isGenerating || messages.filter(m => m.id !== 'welcome').length < 2}
                        style={{
                          background: isGenerating ? t.surfaceEl : t.violetG, color: isGenerating ? t.tm : t.violet,
                          border: `1px solid ${isGenerating ? t.border : t.violetM}`, borderRadius: '6px', padding: '4px 12px',
                          display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer',
                        }}>
                        {isGenerating ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> {generationStatus || 'Generating...'}</> : <><FileCode size={11} /> {isPreviewOpen ? 'Regenerate' : 'Generate'}</>}
                      </button>
                    </div>
                    <button onClick={sendMessage} disabled={!inputMessage.trim() || isSending}
                      style={{
                        background: (inputMessage.trim() && !isSending) ? t.violet : t.surfaceEl, color: (inputMessage.trim() && !isSending) ? 'white' : t.tm,
                        border: 'none', borderRadius: '6px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
                        cursor: (inputMessage.trim() && !isSending) ? 'pointer' : 'not-allowed',
                      }}>
                      <Send size={11} /> Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: Preview Pane */}
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              style={{ borderLeft: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Preview Header with editable agent name */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCode size={13} color={t.ts} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: t.ts }}>agent.md</span>
                    {(generationModel || isGenerating) && (
                      <span style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '3px',
                        background: 'rgba(139,92,246,0.1)', color: t.violet, fontFamily: t.mono, fontWeight: 500,
                      }}>
                        {generationModel || 'gpt-5-mini'}
                      </span>
                    )}
                    {isGenerating && generationStatus && (
                      <span style={{ fontSize: '9px', color: '#22c55e', fontWeight: 500 }}>
                        {generationStatus}
                      </span>
                    )}
                  </div>
                  {validation && (
                    <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: t.tm }}>
                      <span>{validation.totalLines}L</span>
                      <span>{validation.stats?.cssVariables || 0}vars</span>
                      <span>{validation.sections.filter((s: any) => s.found).length}/{validation.sections.length}sec</span>
                    </div>
                  )}
                </div>
                {/* Agent name editor + preview button */}
                {generatedAgent && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.tm, flexShrink: 0 }}>Name:</span>
                    <input type="text" value={agentNameOverride} onChange={e => setAgentNameOverride(e.target.value)}
                      placeholder="agent-name"
                      style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 8px', color: t.tp, fontSize: '12px', fontWeight: 600, fontFamily: t.mono, outline: 'none' }}
                    />
                    {/* Image style picker + preview button */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        <button
                          onClick={() => setShowImageStylePicker(!showImageStylePicker)}
                          style={{
                            padding: '4px 6px', borderRadius: '5px 0 0 5px', fontSize: '9px', fontWeight: 500,
                            background: 'rgba(6,182,212,0.08)', color: t.cyan,
                            border: `1px solid rgba(6,182,212,0.2)`, borderRight: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
                          }}
                          title="Choose image style"
                        >
                          {imageStyle === 'auto' ? 'Auto' : imageStyles.find(s => s.id === imageStyle)?.label || imageStyle}
                          <ChevronDown size={8} style={{ transform: showImageStylePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>
                        <button onClick={generatePreviewImage} disabled={isGeneratingPreview}
                          title={previewImageUrl ? 'Regenerate Preview' : 'Generate Preview'}
                          style={{
                            padding: '4px 10px', borderRadius: '0 5px 5px 0', fontSize: '10px', fontWeight: 600,
                            cursor: isGeneratingPreview ? 'not-allowed' : 'pointer',
                            background: isGeneratingPreview ? t.surfaceEl : 'rgba(6,182,212,0.12)',
                            color: isGeneratingPreview ? t.tm : t.cyan,
                            border: `1px solid ${isGeneratingPreview ? t.border : 'rgba(6,182,212,0.25)'}`,
                            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap',
                          }}>
                          {isGeneratingPreview ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Image size={10} />}
                          {isGeneratingPreview ? '...' : previewImageUrl ? 'Regen' : 'Preview'}
                        </button>
                      </div>
                      {showImageStylePicker && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, zIndex: 60, marginTop: '2px',
                          background: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '8px',
                          overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', minWidth: '180px', maxHeight: '250px', overflowY: 'auto',
                        }}>
                          {imageStyles.map(s => {
                            const isActive = imageStyle === s.id;
                            return (
                              <button key={s.id}
                                onClick={() => { setImageStyle(s.id); setShowImageStylePicker(false); }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
                                  padding: '6px 10px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                  background: isActive ? 'rgba(6,182,212,0.1)' : 'transparent',
                                  borderLeft: isActive ? `2px solid ${t.cyan}` : '2px solid transparent',
                                }}>
                                <div>
                                  <div style={{ fontSize: '10px', color: isActive ? t.tp : t.ts, fontWeight: isActive ? 600 : 400 }}>
                                    {s.label} {s.recommended && s.id !== 'auto' ? <span style={{ fontSize: '7px', color: t.cyan, marginLeft: '3px' }}>REC</span> : ''}
                                  </div>
                                  <div style={{ fontSize: '8px', color: t.tm }}>{s.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section TOC */}
              {agentSections.length > 0 && (
                <div style={{ padding: '6px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {agentSections.map((section, i) => {
                    const sectionFound = validation?.sections.find(s => section.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]));
                    return (
                      <button key={i} onClick={() => setRefineSection(refineSection === section ? null : section)}
                        style={{
                          padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 500, cursor: 'pointer', border: 'none',
                          background: refineSection === section ? t.violetM : (sectionFound?.found ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'),
                          color: refineSection === section ? t.violet : (sectionFound?.found ? t.success : t.warning),
                        }}>
                        {section.slice(0, 18)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Refine Input */}
              {refineSection && (
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                  <div style={{ fontSize: '10px', color: t.violet, fontWeight: 600, marginBottom: '4px' }}>Refine: {refineSection}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" value={refineFeedback} onChange={e => setRefineFeedback(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRefine()}
                      placeholder="What to improve..." style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '5px 8px', color: t.tp, fontSize: '11px', outline: 'none' }} />
                    <button onClick={handleRefine} disabled={isRefining || !refineFeedback.trim()}
                      style={{ padding: '5px 10px', borderRadius: '4px', background: t.violet, border: 'none', color: 'white', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                      {isRefining ? '...' : 'Refine'}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Image */}
              {previewImageUrl && (
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${t.border}`, cursor: 'pointer' }}
                    onClick={() => setShowImageModal(true)}>
                    <img src={previewImageUrl} alt="Preview mockup"
                      style={{ width: '100%', height: 'auto', display: 'block' }} />
                    <div style={{
                      position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px',
                      padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', color: 'white', fontSize: '9px',
                    }}>
                      <Maximize2 size={9} /> Fullscreen
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Content — streams in real-time */}
              <div
                ref={(el) => {
                  // Auto-scroll to bottom during streaming
                  if (el && isGenerating && generatedAgent) {
                    el.scrollTop = el.scrollHeight;
                  }
                }}
                style={{ flex: 1, padding: '14px', fontFamily: t.mono, fontSize: '10px', lineHeight: '1.6', color: t.ts, backgroundColor: t.bg, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {isGenerating && !generatedAgent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px' }}>
                    <RefreshCw size={22} color={t.violet} style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ color: t.ts, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                      {generationStatus || 'Starting generation...'}
                    </div>
                    <div style={{ color: t.tm, fontSize: '10px', fontFamily: 'Inter, sans-serif' }}>
                      {generationQuality === 'fast' ? '~15s' : generationQuality === 'standard' ? '~30s' : '~60s'}
                    </div>
                  </div>
                ) : generatedAgent ? (
                  <>
                    {generatedAgent}
                    {isGenerating && (
                      <span style={{ display: 'inline-block', width: '6px', height: '14px', background: t.violet, marginLeft: '2px', animation: 'blink 0.8s step-end infinite' }} />
                    )}
                  </>
                ) : 'Generate your agent to preview it here...'}
              </div>

              {/* Validation Issues */}
              {validation && validation.issues.length > 0 && (
                <div style={{ padding: '8px 14px', borderTop: `1px solid ${t.border}`, background: 'rgba(245,158,11,0.05)', maxHeight: '70px', overflowY: 'auto' }}>
                  {validation.issues.map((issue, i) => (
                    <div key={i} style={{ fontSize: '9px', color: t.warning, display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '1px' }}>
                      <AlertTriangle size={8} /> {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Save Button */}
              <div style={{ padding: '10px 14px', background: t.surface, borderTop: `1px solid ${t.border}` }}>
                <button onClick={saveAgent} disabled={!generatedAgent || isSaving || isGenerating}
                  style={{
                    width: '100%', background: (generatedAgent && !isSaving && !isGenerating) ? t.violet : t.surfaceEl,
                    color: (generatedAgent && !isSaving && !isGenerating) ? 'white' : t.tm,
                    border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 600, fontSize: '12px',
                    cursor: (generatedAgent && !isSaving && !isGenerating) ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}>
                  <Save size={13} /> {isSaving ? 'Saving...' : `Save${agentNameOverride ? ` "${agentNameOverride}"` : ''} to Library`}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {showImageModal && previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
            <button onClick={() => setShowImageModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} color="white" />
            </button>
            <img src={previewImageUrl} alt="Preview fullscreen"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: '8px', cursor: 'default' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
};

export default AgentCreator;
