# node:sqlite is stable from Node 22.12.0 — do not downgrade below 22.12
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer-cached independently of source changes)
COPY package*.json ./
RUN npm ci

# Source is mounted as a volume in dev; this COPY is used only for production builds
COPY . .

# Ensure the run-script working directory exists at container start
RUN mkdir -p /tmp/ci-runs

EXPOSE 3000

# tsx watch gives hot-reload in dev; swap for `node dist/server.js` for prod
CMD ["npm", "run", "dev"]
