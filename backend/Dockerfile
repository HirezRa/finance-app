FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat git

COPY backend/package.json ./
RUN npm install

# npm `github:` tarball often omits `src/`; clone fork and build lib/ for runtime
RUN rm -rf node_modules/israeli-bank-scrapers && \
    git clone --depth 1 https://github.com/HirezRa/israeli-bank-scrapers.git \
      node_modules/israeli-bank-scrapers && \
    cd node_modules/israeli-bank-scrapers && \
    npm install --include=dev --no-audit --no-fund && \
    npm run build:js

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
    ttf-freefont

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
