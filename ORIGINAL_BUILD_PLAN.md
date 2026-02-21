# Fork simple-vscode: Replace Terminal with Conversation GUI

## Context

The current simple-vscode IDE uses a terminal (xterm.js + node-pty) for Claude Code interaction. The user has a separate project ([cc-session-backup](https://github.com/madeinglasgow/cc-session-backup)) with a viewer that renders Claude Code sessions with rich formatting (tool chips, bash terminal chrome, thinking blocks, etc.).

**Goal**: Fork simple-vscode and replace the terminal with a full interactive conversation GUI powered by the Claude Code Agent SDK (`@anthropic-ai/claude-agent-sdk`). Users type messages in a web UI and see Claude's responses rendered with the same rich formatting as the viewer.

**Key finding**: The Agent SDK provides an async generator (`query()`) that yields typed streaming messages, supports session resume, and has a `canUseTool` callback for permission handling — everything needed for a WebSocket bridge.

**Auth change**: OAuth won't work in non-interactive mode. The fork will use `ANTHROPIC_API_KEY` instead.

---

## Architecture

```
Browser (React)                    Server (Node.js)                Claude Code
┌─────────────────┐    WS /ws/conversation    ┌──────────────┐    Agent SDK    ┌─────────────┐
│ ConversationPanel│◄──────────────────────────►│conversation.js│◄──────────────►│ claude-code  │
│  MessageList     │   stream events, prompts  │              │   query() gen  │ subprocess   │
│  MessageInput    │   user msgs, approvals    │  canUseTool  │                │              │
│  PermissionUI    │                           │  callback    │                │              │
└─────────────────┘                            └──────────────┘                └─────────────┘
```

---

## Phase 1: Fork, Scaffold, and Backend Bridge (MVP) ✅ COMPLETE

### Step 1: Fork the repo
- Use `gh repo fork madeinglasgow/simple-vscode --fork-name claude-ide --clone` to create a GitHub fork
- Clone into a new working directory (e.g. `~/Projects/claude-ide`)
- Update CLAUDE.md, SPEC.md, package.json with new project name
- All subsequent work happens in the forked repo; `simple-vscode` stays untouched

### Step 2: Backend — `server/conversation.js`
Create WebSocket handler (following pattern of `server/pty.js`):
- On connection: initialize state (sessionId, abortController, pendingPermissions map)
- On `user_message`: call `query({ prompt, options })` with Agent SDK
- Stream SDK events to client: `session_init`, `assistant_message`, `stream_delta`, `stream_block_start/stop`, `status`
- Implement `canUseTool` callback: send `permission_request` to client, return Promise that resolves when client sends `permission_response`
- Handle `interrupt` / `abort` messages via AbortController
- Handle `resume_session` with `options: { resume: sessionId }`

### Step 3: Backend — Wire up in `server/index.js`
- Add `/ws/conversation` WebSocket upgrade path alongside `/ws/terminal`
- Add `@anthropic-ai/claude-agent-sdk` to `package.json`
- Pass `ANTHROPIC_API_KEY` and `WORKSPACE_DIR` to SDK options

### Step 4: Frontend — Core conversation components

**`client/src/components/ConversationPanel.jsx`** — Top-level, replaces `<Terminal />`
- Manages WebSocket connection to `/ws/conversation`
- Holds message array state
- Contains `<MessageList>`, `<MessageInput>`, `<StatusBar>`

**`client/src/components/MessageList.jsx`** — Scrollable message container
- Renders array of `<MessageCard>` components
- Auto-scroll to bottom on new messages (unless user scrolled up)

**`client/src/components/MessageCard.jsx`** — Single conversation turn
- User messages: coral left border, text content
- Assistant messages: dark left border, text content
- MVP: just render text blocks (tool rendering comes in Phase 2)

**`client/src/components/MessageInput.jsx`** — Input area
- Auto-growing `<textarea>`
- Enter to send, Shift+Enter for newline
- Disabled while Claude is generating
- Send button

**`client/src/components/StatusBar.jsx`** — Status indicator
- Shows: idle / thinking / executing tool / waiting for permission

### Step 5: Frontend — Update `App.jsx`
- Replace `<Terminal />` with `<ConversationPanel />` in the right column
- Change header label from "Terminal" to "Claude"
- Keep preview panel integration working

### Step 6: Docker/env updates
- `Dockerfile`: Add `ANTHROPIC_API_KEY` env var
- `docker-compose.yml`: Add `ANTHROPIC_API_KEY` passthrough
- Keep `node-pty` and terminal for now (fallback)

**MVP outcome**: Send text messages, see text responses streaming in, basic layout working.

---

## Phase 2: Rich Message Rendering

Port rendering logic from `viewer.html` (~1970 lines) into React components. Each `renderFoo()` function in the viewer maps 1:1 to a component.

| viewer.html function | React component | Purpose |
|---|---|---|
| `renderTurn()` | `MessageCard.jsx` | Message layout with role badges |
| `renderToolChip()` | `ToolChip.jsx` | Clickable tool name + icon chip |
| `renderToolExpansion()` | `ToolExpansion.jsx` | Expanded tool details (file content, diffs) |
| `renderBashTerminal()` | `BashTerminal.jsx` | macOS-chrome terminal block |
| `renderThinkingBlock()` | `ThinkingBlock.jsx` | Collapsible internal turn group |
| `getToolIcon()` / `getToolDetail()` | utilities in `ToolChip.jsx` | Icon and summary mapping |

**New components:**
- `ToolChip.jsx` — Expandable chip (tool name + icon + short detail)
- `ToolExpansion.jsx` — Expanded content: file reads, edit diffs, search results
- `BashTerminal.jsx` — macOS window chrome (red/yellow/green dots) + terminal output
- `ThinkingBlock.jsx` — Collapsible group for internal tool-use turns
- `CodeBlock.jsx` — Syntax-highlighted code blocks in message text
- `PermissionBanner.jsx` — Pinned above input: tool name, action summary, Allow/Deny buttons
- `QuestionCard.jsx` — Inline AskUserQuestion with radio buttons + free text

**CSS**: Extract styles from `viewer.html` `<style>` block, remap to existing `app.css` custom properties (viewer's `--coral: #F87171` → `--accent: #e8736a`).

---

## Phase 3: Streaming UX

**`client/src/hooks/useConversation.js`** — Central state hook
- Manages WebSocket lifecycle (connect, reconnect, message handling)
- Maintains `messages` array with streaming accumulation
- Tracks per-block text buffers for `text_delta` and `input_json_delta` events
- Exposes: `messages`, `status`, `sendMessage()`, `respondPermission()`, `interrupt()`

**`client/src/components/StreamingText.jsx`** — Live text rendering
- Accumulates `text_delta` events, renders progressively
- Cursor/typing indicator at end of stream

**`client/src/components/ToolProgress.jsx`** — Tool execution indicator
- Spinner shown between `content_block_start` (tool_use) and result

---

## Phase 4: Session Management

- **`server/sessions.js`** — Track session metadata (topic, timestamps, message count)
- **`client/src/components/SessionSidebar.jsx`** — List/resume past sessions
- Store `sessionId` in localStorage; auto-resume on page reload
- "New conversation" button to start fresh

---

## Phase 5: Terminal Fallback Toggle

- Add mode toggle in the right column header: "Conversation" / "Terminal"
- Keep `Terminal.jsx` and `server/pty.js` intact
- Terminal mode useful for: interactive programs, OAuth setup, manual debugging

---

## WebSocket Protocol Summary

**Client → Server:**
- `{ type: "user_message", text, images? }` — send prompt
- `{ type: "resume_session", sessionId }` — resume session
- `{ type: "permission_response", requestId, behavior: "allow"|"deny" }` — approve/deny tool
- `{ type: "interrupt" }` — stop generation

**Server → Client:**
- `{ type: "session_init", sessionId, model }` — session started
- `{ type: "stream_block_start", blockIndex, contentBlock }` — new content block
- `{ type: "stream_delta", blockIndex, delta }` — streaming text/JSON chunk
- `{ type: "stream_block_stop", blockIndex }` — block complete
- `{ type: "assistant_message", content, toolCalls }` — full message (after streaming)
- `{ type: "permission_request", requestId, toolName, input }` — needs approval
- `{ type: "result", sessionId, cost, usage }` — turn complete
- `{ type: "status", state }` — status update
- `{ type: "error", message }` — error

---

## Key Files to Modify (from simple-vscode)

- `server/index.js` — Add `/ws/conversation` WebSocket path
- `client/src/App.jsx` — Swap Terminal for ConversationPanel
- `client/src/styles/app.css` — Add conversation UI styles from viewer.html
- `package.json` — Add `@anthropic-ai/claude-agent-sdk`
- `Dockerfile` — Add `ANTHROPIC_API_KEY` env var
- `docker-compose.yml` — Add `ANTHROPIC_API_KEY` passthrough

## Key Files to Reference (from cc-session-backup)

- `viewer/viewer.html` — Source of all rendering logic to port (lines ~200-1970)

---

## Verification

After each phase:
1. `docker compose up --build`
2. Open `http://localhost:3000`
3. Phase 1: Type a message → see streamed text response
4. Phase 2: Ask Claude to read a file → see tool chips and expanded content
5. Phase 3: Watch live streaming text with typing indicator
6. Phase 4: Refresh page → conversation resumes
7. Phase 5: Toggle to terminal → run manual commands
