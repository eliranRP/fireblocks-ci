FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Source mounted as volume in dev; this COPY used for production builds
COPY . .

EXPOSE 5173

# --host is passed via vite.config.ts server.host:true — binds to 0.0.0.0
CMD ["npm", "run", "dev"]
