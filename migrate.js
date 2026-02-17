const { Client } = require('pg');

const projectRef = 'ccimszifxyvgvfggpnql';
const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = `postgresql://postgres.${projectRef}:${password}@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`;

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');

    await client.query(`
      ALTER TABLE agent_conversations
        ADD COLUMN IF NOT EXISTS design_brief jsonb DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS generated_agent text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS generation_status text DEFAULT NULL;
    `);
    console.log('Added columns to agent_conversations');

    await client.query(`
      ALTER TABLE agent_conversation_references
        ADD COLUMN IF NOT EXISTS structured_analysis jsonb DEFAULT NULL;
    `);
    console.log('Added column to agent_conversation_references');

    // Fork feature: track agent forks
    await client.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS forked_from text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS fork_count integer DEFAULT 0;
    `);
    console.log('Added forked_from and fork_count columns to agents');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}
migrate();
