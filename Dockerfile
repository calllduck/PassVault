# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY views ./views

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Update Alpine packages untuk patch CVE di OS layer
RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/src ./src
COPY --from=builder /app/views ./views
EXPOSE 3000
CMD ["node", "src/app.js"]