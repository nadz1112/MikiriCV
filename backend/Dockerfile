FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

