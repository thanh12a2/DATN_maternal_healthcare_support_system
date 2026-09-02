FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run prisma:generate:doctor
ARG APP_NAME=auth-service
RUN npx nest build ${APP_NAME}

RUN npm run prisma:generate && npm run prisma:generate:patient
ARG APP_NAME=auth-service
RUN npx nest build ${APP_NAME}

# Run schema deployment as an explicit one-shot Compose job. Keeping the Prisma
# CLI out of the production app image reduces its runtime dependency surface.
FROM builder AS migrator
ENV PRISMA_SCHEMA=prisma/schema.prisma
CMD npx prisma migrate deploy --schema "$PRISMA_SCHEMA"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
RUN npm ci --omit=dev --omit=optional --omit=peer
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
ARG APP_NAME=auth-service
ENV APP_NAME=${APP_NAME}
ENV PORT=3000
EXPOSE 3000 5000 5003 5005
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
EXPOSE 3000 5000 5003 5004
CMD ["sh", "-c", "exec node dist/apps/$APP_NAME/main.js"]
