FROM node:22-alpine AS builder

WORKDIR /app

# Align with current npm 11.x; silences "npm notice" and uses latest lockfile features
RUN npm install -g npm@11.3.0

RUN apk add --no-cache python3 make g++ openssl libc6-compat git

# HirezRa fork: npm pack ללא lib/ → postinstall (ensure + patch-package) עושה clone + build:js + Yahav patch
COPY backend/package.json backend/package-lock.json ./
COPY backend/scripts ./scripts
COPY backend/patches ./patches
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/scripts ./scripts
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
COPY VERSION ./VERSION

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    git \
    docker-cli \
    docker-cli-compose

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/VERSION ./VERSION

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
