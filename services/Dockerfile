FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate

ARG APP_NAME=auth-service
RUN npx nest build ${APP_NAME}

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

ARG APP_NAME=auth-service
ENV APP_NAME=${APP_NAME}
ENV PORT=3000

EXPOSE 3000 5000 5003

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
