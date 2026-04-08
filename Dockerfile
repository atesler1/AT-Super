FROM node:22-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server

# Install client dependencies (fresh install — no Windows lockfile)
COPY client/package.json ./client/
RUN npm install --prefix client

# Build client
COPY client/ ./client/
RUN npm run build --prefix client

# Copy server source
COPY server/ ./server/

EXPOSE 3001
CMD ["node", "server/index.js"]
