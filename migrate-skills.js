// Migration: Skill Creator — hierarchical file-based skills + conversations
// Run: node migrate-skills.js

require('dotenv').config();
const { Client } = require('pg');

const projectRef = 'ccimszifxyvgvfggpnql';
const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = `postgresql://postgres.${projectRef}:${password}@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`;

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');

    // 1. ALTER skills table — add file-based columns
    await client.query(`
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS file_tree JSONB DEFAULT NULL;
    `);
    console.log('Added file_tree to skills');

    await client.query(`
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    `);
    console.log('Added source to skills');

    await client.query(`
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS entry_point TEXT DEFAULT 'SKILL.md';
    `);
    console.log('Added entry_point to skills');

    await client.query(`
      ALTER TABLE skills ADD COLUMN IF NOT EXISTS total_files INTEGER DEFAULT 0;
    `);
    console.log('Added total_files to skills');

    // 2. CREATE skill_conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
        name TEXT DEFAULT 'New Skill',
        context JSONB DEFAULT '{}',
        created_at BIGINT DEFAULT extract(epoch from now()),
        updated_at BIGINT DEFAULT extract(epoch from now())
      );
    `);
    console.log('Created skill_conversations table');

    // 3. CREATE skill_conversation_messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_conversation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES skill_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        file_context TEXT DEFAULT NULL,
        created_at BIGINT DEFAULT extract(epoch from now())
      );
    `);
    console.log('Created skill_conversation_messages table');

    // 4. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_skill_conversations_user ON skill_conversations(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_skill_conversations_skill ON skill_conversations(skill_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_skill_conv_messages_conv ON skill_conversation_messages(conversation_id);
    `);
    console.log('Created indexes');

    console.log('\nMigration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
