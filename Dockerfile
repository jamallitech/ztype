FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/core packages/core
RUN npm run build -w @ztype/api

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN npm ci --omit=dev --workspace=@ztype/api --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
