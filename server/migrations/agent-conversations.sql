-- Agent Creator Conversations
-- Stores GPT-5 conversations for creating custom agents

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Agent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated_at ON agent_conversations(updated_at DESC);

-- Conversation messages (user and assistant turns)
CREATE TABLE IF NOT EXISTS agent_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_messages_conversation_id ON agent_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversation_messages_created_at ON agent_conversation_messages(created_at ASC);

-- Conversation references (images and URLs)
CREATE TABLE IF NOT EXISTS agent_conversation_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'url')),
  url TEXT,
  filename TEXT,
  analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_references_conversation_id ON agent_conversation_references(conversation_id);

COMMENT ON TABLE agent_conversations IS 'Stores GPT-5 agent creation conversations';
COMMENT ON TABLE agent_conversation_messages IS 'Messages within agent creation conversations';
COMMENT ON TABLE agent_conversation_references IS 'Images and URLs referenced in conversations';
