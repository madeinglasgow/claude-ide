# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude IDE — a browser-based IDE with a conversation GUI powered by the Claude Code Agent SDK. Forked from simple-vscode, replacing the terminal with an interactive chat interface where users type messages and see Claude's responses rendered with rich formatting (tool chips, bash terminal chrome, thinking blocks, etc.).

## Tech Stack

- **Frontend**: React 18 + Vite, CodeMirror 6 (editor)
- **Backend**: Node.js + Express, `@anthropic-ai/claude-code` (Agent SDK), node-pty (terminal fallback), ws (WebSocket)
- **AI Coding**: Claude Code Agent SDK (programmatic, uses `ANTHROPIC_API_KEY`)
- **Deployment**: Docker with `node:20-bookworm` (Debian, not Alpine — node-pty requires glibc)

## Architecture

Two-column CSS Grid layout (left panel | conversation):
- **Documents** (left, top): Flat markdown file list with left-border coral accent for active item, auto-polls `/api/files/tree` every 2s
- **Editor** (left, bottom): CodeMirror 6 with markdown support, clean toolbar (filename + "Unsaved" hint + pill Save button), save via button or Cmd+S
- **Conversation** (right, hero): Chat UI connected to Agent SDK via WebSocket at `/ws/conversation`. Full right column. Messages stream in with tool chips, code blocks, and permission prompts.

Server exposes:
- REST API at `/api/files/{tree,read,write}` for file operations (see `server/files.js`)
- WebSocket at `/ws/conversation` for Agent SDK bridge (see `server/conversation.js`)
- WebSocket at `/ws/terminal` for PTY fallback (see `server/pty.js`)
- All file paths validated against `WORKSPACE_DIR` to prevent directory traversal

## Key Files

- `client/src/styles/app.css` — All theming via CSS custom properties. Edit this file to change colors/layout.
- `client/src/App.jsx` — Main layout and state (open file, dirty state, panel collapse)
- `client/src/hooks/useConversation.js` — Central state hook for WebSocket lifecycle, message accumulation, streaming
- `client/src/components/ConversationPanel.jsx` — Top-level conversation UI (replaces Terminal)
- `client/src/components/MessageCard.jsx` — Single message rendering with tool chips
- `client/src/components/ToolChip.jsx` — Expandable tool name + icon chip
- `server/conversation.js` — WebSocket handler bridging to Agent SDK
- `server/index.js` — Express server, WebSocket upgrade handler, static file serving in production
- `docker-compose.yml` — Dev mode mounts local source for hot reload; production builds client into image

## Visual Style

Educational platform aesthetic inspired by deeplearning.ai — not an IDE feel. Coral/salmon accent (`#e8736a`), light pink sidebar, white editor area. Normal-case 21px section labels, left-border file accents (no background fill), pill-shaped Save button, invisible resize handles, soft borders throughout. All colors are CSS custom properties in `app.css` for easy adjustment.

## Running

```bash
# Dev mode (hot reload — open http://localhost:5173)
ANTHROPIC_API_KEY=sk-... docker compose up --build

# Production (open http://localhost:3000)
# Change docker-compose.yml command back to: node server/index.js
```

## Environment Variables

- `ANTHROPIC_API_KEY` — Required. Anthropic API key for the Agent SDK.
- `WORKSPACE_DIR` — Root dir for file browser (default: `/workspace`)
- `TERMINAL_CMD` — Shell to spawn in terminal (default: `/bin/bash`)
- `IDE_PORT` — IDE server port (default: `3000`). Named `IDE_PORT` instead of `PORT` to avoid collisions with user apps that read `PORT`.

## WebSocket Protocol

**Client → Server (`/ws/conversation`):**
- `{ type: "user_message", text }` — Send a prompt
- `{ type: "resume_session", sessionId }` — Resume existing session
- `{ type: "permission_response", requestId, behavior: "allow"|"deny" }` — Approve/deny tool
- `{ type: "interrupt" }` — Stop generation

**Server → Client:**
- `{ type: "session_init", sessionId, model }` — Session started
- `{ type: "stream_event", event }` — Streaming text/JSON chunk (Anthropic raw stream events)
- `{ type: "assistant_message", message }` — Full message (after streaming)
- `{ type: "permission_request", requestId, toolName, input }` — Needs approval
- `{ type: "result", sessionId, cost }` — Turn complete
- `{ type: "status", state }` — Status update (idle/thinking/streaming/tool_executing/waiting_permission)
- `{ type: "error", message }` — Error

## Web App Preview

The conversation header has a "Preview" toggle button that opens an embedded iframe panel alongside the conversation. When activated, the left panel auto-collapses and the area splits 50/50 into conversation + preview with a draggable resize handle.

**Port conventions**: User frontend runs on port **5173**, backend on port **8000**. The IDE server uses port 3000.

Note: In dev mode, port 5173 is occupied by the IDE's own Vite dev server, so preview only works in production mode (`node server/index.js` on port 3000).
