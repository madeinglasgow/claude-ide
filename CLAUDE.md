# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A simplified, browser-based IDE for a learning platform. Inspired by VSCode but with a streamlined UI focused on editing markdown specification files for AI coders. The app runs containerized in Docker and opens in the browser.

## Tech Stack

- **Frontend**: React 18 + Vite, xterm.js (terminal), CodeMirror 6 (editor)
- **Backend**: Node.js + Express, node-pty (PTY), ws (WebSocket)
- **AI Coding**: Claude Code CLI (installed globally in container)
- **Deployment**: Docker with `node:20-bookworm` (Debian, not Alpine — node-pty requires glibc)

## Architecture

Two-column CSS Grid layout (left panel | terminal):
- **Documents** (left, top): Flat markdown file list with left-border coral accent for active item, auto-polls `/api/files/tree` every 2s
- **Editor** (left, bottom): CodeMirror 6 with markdown support, clean toolbar (filename + "Unsaved" hint + pill Save button), save via button or Cmd+S
- **Terminal** (right, hero): xterm.js connected to server PTY via WebSocket at `/ws/terminal`. Full right column. Claude Code CLI pre-installed; users authenticate via OAuth.

Server exposes:
- REST API at `/api/files/{tree,read,write}` for file operations (see `server/files.js`)
- WebSocket at `/ws/terminal` for PTY (see `server/pty.js`)
- All file paths validated against `WORKSPACE_DIR` to prevent directory traversal

## Key Files

- `client/src/styles/app.css` — All theming via CSS custom properties. Edit this file to change colors/layout.
- `client/src/App.jsx` — Main layout and state (open file, dirty state, panel collapse, terminal resize)
- `server/index.js` — Express server, WebSocket upgrade handler, static file serving in production
- `docker-compose.yml` — Dev mode mounts local source for hot reload; production builds client into image

## Visual Style

Educational platform aesthetic inspired by deeplearning.ai — not an IDE feel. Coral/salmon accent (`#e8736a`), light pink sidebar, white editor area. Normal-case 21px section labels, left-border file accents (no background fill), pill-shaped Save button, invisible resize handles, soft borders throughout. All colors are CSS custom properties in `app.css` for easy adjustment.

## Running

```bash
# Dev mode (hot reload — open http://localhost:5173)
docker compose up --build

# Production (open http://localhost:3000)
# Change docker-compose.yml command back to: node server/index.js
```

## Environment Variables

- `WORKSPACE_DIR` — Root dir for file browser (default: `/workspace`)
- `TERMINAL_CMD` — Shell to spawn in terminal (default: `/bin/bash`)
- `IDE_PORT` — IDE server port (default: `3000`). Named `IDE_PORT` instead of `PORT` to avoid collisions with user apps that read `PORT`.

## Web App Preview

The terminal header has a "Preview" toggle button that opens an embedded iframe panel alongside the terminal. When activated, the left panel auto-collapses and the terminal area splits 50/50 into terminal + preview with a draggable resize handle.

**Port conventions**: User frontend runs on port **5173**, backend on port **8000**. The IDE server uses port 3000. AI instructions should tell Claude Code to use these ports when building web apps.

Note: In dev mode, port 5173 is occupied by the IDE's own Vite dev server, so preview only works in production mode (`node server/index.js` on port 3000).
