FROM node:24-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/game/package.json packages/game/package.json
COPY packages/test-support/package.json packages/test-support/package.json
COPY tests/e2e/package.json tests/e2e/package.json

RUN pnpm install --frozen-lockfile

COPY . .

FROM workspace AS build

RUN pnpm --filter @avalon/server build \
 && pnpm --filter @avalon/web build \
 && pnpm --filter @avalon/server deploy --prod --legacy /runtime/server

FROM node:24-bookworm-slim AS server

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /runtime/server/ ./
COPY --from=build --chown=node:node /workspace/apps/server/dist/ ./dist/

USER node

EXPOSE 8000 8001

CMD ["node", "dist/index.js"]

FROM nginx:1.28.3-alpine-slim AS gateway

COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist/ /usr/share/nginx/html/

EXPOSE 8080
