# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React app ----------
FROM node:26-alpine AS build
WORKDIR /app
# Dependencies first, so this layer is reused until package*.json changes
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# CRA bakes REACT_APP_* values into the bundle at build time.
# Empty = relative /api URLs, which nginx below proxies to the backend.
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---------- Stage 2: serve the static files with nginx ----------
FROM nginx:1.27-alpine AS runtime
# Where nginx forwards /api requests (the compose service name by default)
ENV API_UPSTREAM=http://api:5000
# Files in /etc/nginx/templates get ${VAR}s filled in when the container starts
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
# Only the built files are copied: no Node, no source code, no node_modules
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
