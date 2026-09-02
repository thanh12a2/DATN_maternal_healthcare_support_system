FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Generate all Prisma clients required by services sharing this image.
RUN npm run prisma:generate \
    && npm run prisma:generate:doctor \
    && npm run prisma:generate:patient

ARG APP_NAME=auth-service
RUN npx nest build $APP_NAME

# Run schema deployment as an explicit one-shot Compose job. Keeping the Prisma
# CLI out of the production app image reduces its runtime dependency surface.
FROM builder AS migrator
ENV PRISMA_SCHEMA=prisma/schema.prisma
CMD ["sh", "-c", "exec npx prisma migrate deploy --schema \"$PRISMA_SCHEMA\""]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma

ARG APP_NAME=auth-service
ENV APP_NAME=$APP_NAME
ENV PORT=3000

EXPOSE 3000 5000 5003 5004 5005
CMD ["sh", "-c", "exec node dist/apps/$APP_NAME/main.js"]
