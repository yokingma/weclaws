ARG AGENT_BROWSER_NPM_VERSION=0.27.0
ARG BUN_VERSION=1.3.13
ARG PNPM_VERSION=9.15.4
ARG UV_VERSION=0.11.7

FROM node:20-bookworm

ENV NODE_ENV=production
ENV PATH="/usr/local/bin:${PATH}"

ARG TARGETARCH
ARG SANDBOX_RUNTIME_NPM_VERSION
ARG AGENT_BROWSER_NPM_VERSION
ARG BUN_VERSION
ARG PNPM_VERSION
ARG UV_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    bubblewrap \
    ca-certificates \
    chromium \
    curl \
    ffmpeg \
    file \
    g++ \
    gh \
    git \
    jq \
    make \
    pandoc \
    poppler-utils \
    procps \
    python3 \
    ripgrep \
    socat \
    unzip \
    zip \
  && rm -f /etc/passwd- /etc/shadow- /etc/group- /etc/gshadow- \
  && rm -rf /var/lib/apt/lists/*

ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium

RUN set -eux; \
  case "$TARGETARCH" in \
    amd64) bun_target="linux-x64-baseline" ;; \
    arm64) bun_target="linux-aarch64" ;; \
    *) echo "Unsupported TARGETARCH for bun: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-${bun_target}.zip" -o /tmp/bun.zip; \
  unzip -oq /tmp/bun.zip -d /tmp/bun; \
  mv "/tmp/bun/bun-${bun_target}/bun" /usr/local/bin/bun; \
  chmod +x /usr/local/bin/bun; \
  rm -rf /tmp/bun /tmp/bun.zip \
  && bun --version
RUN npm install -g pnpm@${PNPM_VERSION} \
  && pnpm --version
RUN curl -LsSf https://astral.sh/uv/${UV_VERSION}/install.sh | env UV_UNMANAGED_INSTALL="/usr/local/bin" sh \
  && uv --version
COPY infra/docker/sandbox-runtime.versions.env /tmp/sandbox-runtime.versions.env
RUN set -eux; \
  configured_sandbox_runtime_version="${SANDBOX_RUNTIME_NPM_VERSION:-}"; \
  . /tmp/sandbox-runtime.versions.env; \
  default_sandbox_runtime_version="${SANDBOX_RUNTIME_NPM_VERSION:-}"; \
  SANDBOX_RUNTIME_NPM_VERSION="${configured_sandbox_runtime_version:-$default_sandbox_runtime_version}"; \
  test -n "$SANDBOX_RUNTIME_NPM_VERSION"; \
  npm install -g "@fastagent/sandbox-runtime@${SANDBOX_RUNTIME_NPM_VERSION}"
RUN npm install -g agent-browser@${AGENT_BROWSER_NPM_VERSION}
RUN if [ "$TARGETARCH" = "arm64" ]; then \
    echo "Skipping agent-browser install --with-deps on linux/arm64; using system chromium"; \
  else \
    agent-browser install --with-deps; \
  fi

WORKDIR /app

COPY infra/sandbox-runtime /app/infra/sandbox-runtime

RUN mkdir -p /app/apps/sandbox-runtime/user-workspaces

CMD ["node", "/app/infra/sandbox-runtime/entry.mjs"]
