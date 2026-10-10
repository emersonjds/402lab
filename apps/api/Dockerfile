# Build from the repository root: docker build -f apps/api/Dockerfile .
# The API runs its TypeScript through tsx: @402lab/shared ships as .ts, and a bundle would
# break the `import.meta.url` path that src/shared/db/migrate.ts uses to find drizzle/.
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS dependencies
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --prod --frozen-lockfile --filter @402lab/api...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=dependencies /app ./
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src
# Migrations are applied at boot, so they ship with the image.
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 8080}/services`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--import", "tsx", "src/server.ts"]
