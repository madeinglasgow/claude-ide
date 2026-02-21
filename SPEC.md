# Simplified Browser-Based IDE

## Project Overview

A streamlined, browser-based IDE for a learning platform. Inspired by VSCode but with a simplified UI focused on editing markdown specification files for AI coders. The app runs containerized in Docker and opens in the browser.

## Tech Stack

- **Frontend**: React 18 + Vite, xterm.js (terminal), CodeMirror 6 (editor)
- **Backend**: Node.js + Express, node-pty (PTY), ws (WebSocket)
- **AI Coding**: Claude Code CLI (installed globally in container)
- **Deployment**: Docker (Debian-based `node:20-bookworm` image for node-pty compatibility)

## Features

### Documents Panel (left column, top)
- Flat list of markdown files in the workspace (`.md` / `.markdown`)
- File extensions shown in display names
- Active file indicated by a 3px coral left-border accent (no background fill)
- Click to open files in the editor below
- Auto-refreshes every 2 seconds to pick up changes from the terminal
- "+" button to create new documents
- Hidden files and `node_modules` excluded

### Text Editor (left column, bottom)
- CodeMirror 6 with markdown language support and monospace font
- Light theme matching the platform style
- Active line highlighting, no line numbers by default
- Clean toolbar above editor: filename, "Unsaved" text hint when dirty, pill-shaped Save button, close button
- Save via pill-shaped **Save** button or Cmd+S / Ctrl+S
- File read/write through REST API (`GET /api/files/read`, `POST /api/files/write`)
- Spacious content padding (16px 24px) for a writing-focused feel

### Terminal (right column — hero)
- xterm.js connected to a server-side PTY via WebSocket (`/ws/terminal`)
- Takes up the full right column as the primary interaction area
- Auto-resizes via FitAddon + ResizeObserver
- Light theme consistent with the rest of the UI
- Minimal header — reduced visual weight, no accent border
- Default shell is `/bin/bash`, configurable via `TERMINAL_CMD` env var
- Spawns in the workspace directory
- Claude Code CLI pre-installed — run `claude` to start an AI coding session
- Users authenticate via OAuth (Claude Pro/Teams/Max subscription) on first use
- One shell process per WebSocket connection — no multiplexing or session persistence
- Refreshing the browser creates a new shell; terminal state (command history, running processes) is lost on reconnect

### Web App Preview (right column, alongside terminal)
- "Preview" toggle button in the terminal header opens an embedded iframe panel
- When activated, the left panel auto-collapses and the terminal area splits 50/50 into terminal + preview
- Draggable resize handle between terminal and preview sub-panels
- Preview loads from port 5173 (`http://<hostname>:5173`)
- Preview button indicates port status: green when port 5173 is live, grey when inactive
- Port status polled every 3 seconds via `no-cors` fetch
- When port is not live, preview shows a placeholder message
- Refresh button (↻) appears in the preview header when the port is live
- Closing the preview restores the previous left panel state

### Panel Layout
- Two-column CSS Grid: left panel (documents + editor stacked) | terminal (right)
- Left panel collapsible with close button; hamburger toggle to restore
- Draggable vertical resize handle between left panel and terminal
- Draggable horizontal resize handle between documents list and editor within left panel
- Draggable horizontal resize handle between terminal and preview when preview is active
- Resize handles are invisible by default, subtle gray on hover

## Visual Style

- Educational platform aesthetic inspired by deeplearning.ai — not an IDE feel
- Coral/salmon accent color (`#e8736a`) for active states, save button, left-border accents
- Light pink sidebar background, white editor area
- Normal-case section labels (21px, semibold) — no uppercase/letter-spacing
- File list uses left-border accent pattern instead of background fill
- Editor toolbar (not tabs): filename + "Unsaved" hint + pill Save button
- Buttons use 8px border-radius throughout; Save button uses pill shape (20px)
- Softer borders (`--border-light`) between panels; no heavy accent borders
- Resize handles invisible by default, subtle on hover only
- CSS custom properties for easy theme adjustments (single file: `client/src/styles/app.css`)

## File Structure

```
package.json              # Server deps + orchestration scripts
server/
  index.js                # Express + HTTP server + WS upgrade
  files.js                # REST API: /api/files/{tree,read,write}
  pty.js                  # node-pty + WebSocket bridge
client/
  package.json            # React, xterm, CodeMirror deps
  index.html              # Vite entry point
  vite.config.js          # Proxy /api and /ws to Express in dev
  src/
    index.jsx             # React mount
    App.jsx               # 3-panel layout + file open/save state
    styles/app.css        # CSS variables, grid layout, theming
    components/
      Terminal.jsx         # xterm.js + WebSocket + FitAddon
      FileBrowser.jsx      # Recursive tree + auto-polling
      Editor.jsx           # CodeMirror + markdown + save shortcut
      Preview.jsx          # Preview iframe panel + port status display
      Panel.jsx            # Generic collapsible panel wrapper
Dockerfile
docker-compose.yml
```

## Running

### Docker (recommended)
```bash
docker compose up --build
# Open http://localhost:3000
```

### Dev mode (hot reload)
```bash
docker compose up --build
# Open http://localhost:5173
```

Dev mode mounts local `server/` and `client/src/` into the container so changes hot-reload without rebuilding. Configured via volume mounts in `docker-compose.yml`.

## API

- `GET /api/files/tree` — recursive directory listing of the workspace
- `GET /api/files/read?path=<relative-path>` — read file contents
- `POST /api/files/write` `{path, content}` — write file contents
- `WS /ws/terminal` — bidirectional terminal data; JSON `{"type":"resize","cols":N,"rows":N}` for resize

All file paths are validated to prevent directory traversal outside the workspace.

## Configuration

| Env Variable    | Default        | Description                        |
|-----------------|----------------|------------------------------------|
| `WORKSPACE_DIR` | `/workspace`   | Root directory for the file browser |
| `TERMINAL_CMD`  | `/bin/bash`    | Shell command for the terminal      |
| `IDE_PORT`      | `3000`         | IDE server port (namespaced to avoid collisions with user apps) |

### Port Conventions
- **3000** — IDE server (Express + static assets)
- **5173** — User app frontend (shown in Preview iframe)
- **8000** — User app backend
