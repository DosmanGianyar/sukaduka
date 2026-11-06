FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Run auto import if DB does not exist
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]

