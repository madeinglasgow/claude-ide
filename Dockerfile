FROM node:20-bookworm

# Install build tools for node-pty
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root dependencies (server)
COPY package.json package-lock.json* ./
RUN npm install

# Install client dependencies and build
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

# Copy source
COPY server/ ./server/
COPY client/ ./client/

# Build client
RUN cd client && npm run build

# Install Claude Code CLI (kept for terminal fallback)
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory
RUN mkdir -p /workspace

ENV NODE_ENV=production
ENV WORKSPACE_DIR=/workspace
ENV IDE_PORT=3000
# ANTHROPIC_API_KEY must be provided at runtime

EXPOSE 3000

CMD ["node", "server/index.js"]
