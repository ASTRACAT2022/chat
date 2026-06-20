# ---- Build frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# ---- Build backend ----
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY backend/ .
RUN npx prisma generate
RUN npm run build

# ---- Production ----
FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/package.json ./
COPY --from=backend /app/backend/prisma ./prisma
COPY --from=frontend /app/frontend/dist ./public

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
