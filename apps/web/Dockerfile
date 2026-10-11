# Build from the repository root: docker build -f apps/web/Dockerfile .
# Landing page and /app panel are the same Next app, served by the standalone server.
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/mocks/package.json packages/mocks/
RUN npm ci --workspace @402lab/web --include-workspace-root
COPY packages/shared packages/shared
COPY packages/mocks packages/mocks
COPY apps/web apps/web
# Inlined at build time: rewrites (API_URL) land in the routes manifest, NEXT_PUBLIC_* in the bundle.
ARG API_URL=http://api:8080
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_PUBLIC_URL=http://localhost:8080
ARG NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_API_MOCKING=
ENV API_URL=$API_URL \
  NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
  NEXT_PUBLIC_API_PUBLIC_URL=$NEXT_PUBLIC_API_PUBLIC_URL \
  NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL \
  NEXT_PUBLIC_API_MOCKING=$NEXT_PUBLIC_API_MOCKING \
  NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @402lab/web

FROM base AS runtime
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0 \
  PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public apps/web/public
WORKDIR /app/apps/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
