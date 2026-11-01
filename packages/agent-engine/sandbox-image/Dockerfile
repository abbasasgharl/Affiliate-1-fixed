# Build one sandbox image per project, using a base image pinned by digest.
# Example build arg: node:22-alpine@sha256:<verified digest>
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

WORKDIR /opt/agent-project
COPY package.json package-lock.json ./

# Dependencies are fetched only at trusted image-build time. Runtime validation is offline.
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && mkdir -p /opt/npm-cache-seed \
    && cp -a /root/.npm/. /opt/npm-cache-seed/ \
    && chmod -R a+rX /opt/npm-cache-seed \
    && rm -rf /opt/agent-project/node_modules

RUN addgroup -g 10001 -S worker \
    && adduser -u 10001 -S -G worker -h /home/worker worker \
    && mkdir -p /home/worker \
    && chown -R 10001:10001 /home/worker

ENV HOME=/tmp
ENV NPM_CONFIG_CACHE=/tmp/.npm
ENV CI=true
USER 10001:10001
WORKDIR /workspace

# DockerSandboxValidator supplies the fixed command. Do not add credentials or host mounts.
