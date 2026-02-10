# Agent Creator Feature

## Overview

The **Agent Creator** is a conversational AI-powered tool that helps users design and generate custom AI agents using GPT-5. It features:

- **Image Upload & Analysis**: Drag & drop design references, analyzed by GPT-4 Vision
- **URL References**: Add URLs to design inspiration sites
- **Conversational Design**: Chat with GPT-5 to refine the agent's purpose and capabilities
- **Live Preview**: See the generated agent `.md` file in real-time
- **One-Click Deploy**: Save the agent to the library

## Architecture

### Backend Routes (`server/routes/agent-creator.js`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent-creator/conversations` | POST | Create a new conversation |
| `/api/agent-creator/conversations/:id` | GET | Get conversation by ID |
| `/api/agent-creator/conversations/:id/images` | POST | Upload & analyze image (GPT-4 Vision) |
| `/api/agent-creator/conversations/:id/urls` | POST | Add URL reference |
| `/api/agent-creator/conversations/:id/messages` | POST | Send message to GPT-5 |
| `/api/agent-creator/conversations/:id/generate` | POST | Generate final agent file |
| `/api/agent-creator/conversations/:id/references/:refId` | DELETE | Delete reference |

### Frontend Component (`client/src/components/AgentCreator.tsx`)

React component with three main sections:
- **Left Sidebar**: References management (images + URLs)
- **Center**: Chat interface with GPT-5
- **Right Sidebar**: Preview pane for generated agent

## Setup

1. Add to `.env`: `OPENAI_API_KEY=your_key_here`
2. Install dependencies: `npm install multer`
3. Start server: `npm start`

## Usage

1. Click **"Create Agent"** button on Dashboard
2. Upload design references or add URLs
3. Chat with GPT-5 to define the agent
4. Click **"Generate Agent"** to create the `.md` file
5. Review and save to library

## Technical Details

- **Model**: `gpt-5-mini-2025-08-07` (mandatory per CLAUDE.md)
- **Image Analysis**: GPT-4 Vision (gpt-4o)
- **Storage**: In-memory (TODO: migrate to Supabase)
