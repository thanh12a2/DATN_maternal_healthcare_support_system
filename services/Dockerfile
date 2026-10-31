FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Generate every service-owned Prisma client without touching a database.
RUN set -eux; \
    for schema in \
      prisma/schema.prisma \
      prisma/doctor/schema.prisma \
      prisma/patient/schema.prisma \
      prisma/receptionist/schema.prisma \
      prisma/catalog/schema.prisma \
      prisma/appointment/schema.prisma \
      prisma/billing/schema.prisma \
      prisma/medical-record/schema.prisma \
      prisma/queue/schema.prisma \
      prisma/document/schema.prisma \
      prisma/prescription/schema.prisma \
      prisma/treatment-plan/schema.prisma \
      prisma/notification/schema.prisma \
      prisma/audit-log/schema.prisma \
      prisma/reporting/schema.prisma \
      prisma/consultation/schema.prisma; \
    do npx prisma generate --schema "$schema"; done

ARG APP_NAME=auth-service
RUN npx nest build "$APP_NAME"

FROM builder AS migrator
ENV PRISMA_SCHEMA=prisma/schema.prisma
CMD ["sh", "-c", "exec npx prisma migrate deploy --schema $PRISMA_SCHEMA"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/proto ./proto

ARG APP_NAME=auth-service
ENV APP_NAME=$APP_NAME
EXPOSE 5003 5004 5005 5006 5007 5008 5009 5011 5012 5013 5014 5015 5016 5017 5018 5019
CMD ["sh", "-c", "exec node dist/apps/$APP_NAME/main.js"]
