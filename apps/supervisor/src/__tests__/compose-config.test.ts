import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('docker compose supervisor env wiring', () => {
  it('passes FASTAGENT_SANDBOX_MODE through to the supervisor container', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const composeFile = await readFile(composePath, 'utf8');

    expect(composeFile).toContain(
      'FASTAGENT_SANDBOX_MODE: ${FASTAGENT_SANDBOX_MODE:-remote}',
    );
    expect(composeFile).not.toContain('SANDBOX_API_KEY: ${SANDBOX_API_KEY}');
    expect(composeFile).not.toContain('API_KEY: ${SANDBOX_API_KEY}');
  });

  it('keeps the sandbox runtime package version centralized in the Docker version file', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.Dockerfile', import.meta.url),
    );
    const versionFilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.versions.env', import.meta.url),
    );

    const [composeFile, envExample, dockerfile, versionFile] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
      readFile(dockerfilePath, 'utf8'),
      readFile(versionFilePath, 'utf8'),
    ]);

    expect(versionFile).toContain('SANDBOX_RUNTIME_NPM_VERSION=0.5.7');
    expect(composeFile).toContain(
      'SANDBOX_RUNTIME_NPM_VERSION: ${SANDBOX_RUNTIME_NPM_VERSION:-}',
    );
    expect(composeFile).not.toContain('SANDBOX_RUNTIME_NPM_VERSION:-0.5.7');
    expect(dockerfile).toContain('COPY infra/docker/sandbox-runtime.versions.env');
    expect(dockerfile).toContain('. /tmp/sandbox-runtime.versions.env');
    expect(dockerfile).not.toContain('ARG SANDBOX_RUNTIME_NPM_VERSION=0.5.7');
    expect(envExample).toContain('# SANDBOX_RUNTIME_NPM_VERSION=');
    expect(envExample).not.toContain('# SANDBOX_RUNTIME_NPM_VERSION=0.5.7');
    expect(envExample).not.toContain('SANDBOX_RUNTIME_IMAGE=');
  });

  it('pins the sandbox agent-browser package version through the compose build surface', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain(
      'AGENT_BROWSER_NPM_VERSION: ${AGENT_BROWSER_NPM_VERSION:-0.27.0}',
    );
    expect(envExample).toContain('AGENT_BROWSER_NPM_VERSION=0.27.0');
  });

  it('keeps remote sandbox-runtime image builds aligned with the Dockerfile agent-browser default', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.Dockerfile', import.meta.url),
    );
    const cnbConfigPath = fileURLToPath(
      new URL('../../../../.cnb.yml', import.meta.url),
    );

    const [dockerfile, cnbConfig] = await Promise.all([
      readFile(dockerfilePath, 'utf8'),
      readFile(cnbConfigPath, 'utf8'),
    ]);
    const dockerfileVersion = dockerfile.match(/^ARG AGENT_BROWSER_NPM_VERSION=(?<version>\S+)$/m)
      ?.groups?.version;
    const cnbPinnedVersions = Array.from(
      cnbConfig.matchAll(/AGENT_BROWSER_NPM_VERSION:\s*"(?<version>[^"]+)"/g),
      (match) => match.groups?.version,
    );

    expect(dockerfileVersion).toBe('0.27.0');
    expect(cnbPinnedVersions).toEqual([dockerfileVersion, dockerfileVersion]);
    expect(cnbConfig).toContain('--build-arg AGENT_BROWSER_NPM_VERSION="${AGENT_BROWSER_NPM_VERSION}"');
  });

  it('keeps remote sandbox-runtime image builds aligned with the Dockerfile lark-cli default', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.Dockerfile', import.meta.url),
    );
    const cnbConfigPath = fileURLToPath(
      new URL('../../../../.cnb.yml', import.meta.url),
    );

    const [dockerfile, cnbConfig] = await Promise.all([
      readFile(dockerfilePath, 'utf8'),
      readFile(cnbConfigPath, 'utf8'),
    ]);
    const dockerfileVersion = dockerfile.match(/^ARG LARK_CLI_NPM_VERSION=(?<version>\S+)$/m)
      ?.groups?.version;
    const cnbPinnedVersions = Array.from(
      cnbConfig.matchAll(/LARK_CLI_NPM_VERSION:\s*"(?<version>[^"]+)"/g),
      (match) => match.groups?.version,
    );

    expect(dockerfileVersion).toBe('1.0.32');
    expect(cnbPinnedVersions).toEqual([dockerfileVersion, dockerfileVersion]);
    expect(cnbConfig).toContain('--build-arg LARK_CLI_NPM_VERSION="${LARK_CLI_NPM_VERSION}"');
  });

  it('pins bun and uv versions through the sandbox compose build surface', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain(
      'BUN_VERSION: ${BUN_VERSION:-1.3.13}',
    );
    expect(composeFile).toContain(
      'UV_VERSION: ${UV_VERSION:-0.11.7}',
    );
    expect(envExample).toContain('BUN_VERSION=1.3.13');
    expect(envExample).toContain('UV_VERSION=0.11.7');
  });

  it('pins pnpm version through the sandbox compose build surface', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain(
      'PNPM_VERSION: ${PNPM_VERSION:-9.15.4}',
    );
    expect(envExample).toContain('PNPM_VERSION=9.15.4');
  });

  it('keeps optional compose env overrides commented by default in the example file', async () => {
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );
    const envExample = await readFile(envExamplePath, 'utf8');

    expect(envExample).toContain('# COMPOSE_PROJECT_NAME=weclaws');
    expect(envExample).toContain('# WECLAWS_DATA_ROOT=/srv/weclaws/data');
    expect(envExample).toContain('# WEB_ADMIN_EMAILS=admin@example.com');
    expect(envExample).toContain('# WEB_USER_BOT_LIMIT=0');
    expect(envExample).toContain('# SANDBOX_RUNTIME_NPM_VERSION=');
    expect(envExample).toContain('# SRT_DEFAULT_POOL_SIZE=3');
    expect(envExample).toContain('# SRT_DEFAULT_MIN_READY_PROCESSES=1');
    expect(envExample).toContain('# SRT_PORT_BASE=31000');
    expect(envExample).toContain('# SRT_PROXY_PORT_BASE=9100');
    expect(envExample).not.toContain('SANDBOX_API_KEY=replace-me');
    expect(envExample).not.toContain('# SANDBOX_POOL_SIZE=10');
    expect(envExample).not.toContain('FASTAGENT_DEFAULT_PROVIDER=');
    expect(envExample).not.toContain('FASTAGENT_DEFAULT_MODEL=');
    expect(envExample).not.toContain('FASTAGENT_API_KEY=');
    expect(envExample).not.toContain('FASTAGENT_BASE_URL=');
    expect(envExample).not.toContain('FASTAGENT_API_TYPE=');
  });

  it('keeps the user sandbox runtime pool defaults aligned with the documented compose baseline', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain('SRT_DEFAULT_POOL_SIZE: ${SRT_DEFAULT_POOL_SIZE:-3}');
    expect(composeFile).toContain('SRT_DEFAULT_MIN_READY_PROCESSES: ${SRT_DEFAULT_MIN_READY_PROCESSES:-1}');
    expect(composeFile).toContain(
      'SRT_DEFAULT_SESSION_TIMEOUT_MS: ${SRT_DEFAULT_SESSION_TIMEOUT_MS:-600000}',
    );
    expect(composeFile).toContain('SRT_PORT_BASE: ${SRT_PORT_BASE:-31000}');
    expect(composeFile).toContain('SRT_PROXY_PORT_BASE: ${SRT_PROXY_PORT_BASE:-9100}');
    expect(envExample).toContain('SRT_DEFAULT_POOL_SIZE=3');
    expect(envExample).toContain('SRT_DEFAULT_SESSION_TIMEOUT_MS=600000');
  });

  it('wires the user sandbox runtime network policy through the SRT default env surface', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain(
      'SRT_DEFAULT_DENIED_DOMAINS: ${SRT_DEFAULT_DENIED_DOMAINS:-}',
    );
    expect(composeFile).not.toContain('SANDBOX_DEFAULT_ALLOWED_DOMAINS');
    expect(envExample).toContain('SRT_DEFAULT_DENIED_DOMAINS=');
    expect(envExample).not.toContain('SANDBOX_DEFAULT_ALLOWED_DOMAINS');
  });

  it('runs the repo-local sandbox pool manager with private config and per-user workspaces', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.Dockerfile', import.meta.url),
    );
    const externalOverridePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.external-sandbox.yml', import.meta.url),
    );

    const [composeFile, dockerfile] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(dockerfilePath, 'utf8'),
    ]);

    expect(composeFile).toContain(
      'SRT_POOL_CONFIG_FILE: /app/storage/sandbox-runtime-private/srt-pools.json',
    );
    expect(composeFile).toContain(
      'SRT_POOL_STATUS_FILE: /app/storage/sandbox-runtime-private/srt-pool-status.json',
    );
    expect(composeFile).toContain('SRT_MANAGER_PORT: ${SANDBOX_RUNTIME_PORT:-8788}');
    expect(composeFile).toContain('- claws_instances:/app/storage/instances');
    expect(composeFile).toContain('- sandbox_user_workspaces:/app/apps/sandbox-runtime/user-workspaces');
    expect(composeFile).toContain('- sandbox_runtime_private:/app/storage/sandbox-runtime-private');
    expect(dockerfile).toContain('COPY infra/sandbox-runtime /app/infra/sandbox-runtime');
    expect(dockerfile).toContain('CMD ["node", "/app/infra/sandbox-runtime/entry.mjs"]');
    await expect(access(externalOverridePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('keeps the sandbox runtime security profile aligned with the bubblewrap baseline', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const composeFile = await readFile(composePath, 'utf8');

    expect(composeFile).toContain('cap_drop:');
    expect(composeFile).toContain('- ALL');
    expect(composeFile).toContain('cap_add:');
    expect(composeFile).toContain('- SYS_ADMIN');
    expect(composeFile).toContain('- NET_ADMIN');
    expect(composeFile).toContain('cgroup: private');
    expect(composeFile).toContain('security_opt:');
    expect(composeFile).toContain('- seccomp=unconfined');
    expect(composeFile).toContain('- apparmor=unconfined');
  });

  it('defines a production compose override that pulls the published GHCR images', async () => {
    const prodComposePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.prod.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );
    const [prodComposeFile, envExample] = await Promise.all([
      readFile(prodComposePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(prodComposeFile).toContain(
      'image: ghcr.io/yokingma/weclaws/sandbox-runtime:latest',
    );
    expect(prodComposeFile).toContain(
      'image: ghcr.io/browserless/chromium:latest',
    );
    expect(prodComposeFile).toContain(
      'image: ghcr.io/yokingma/weclaws/supervisor:latest',
    );
    expect(prodComposeFile).toContain('image: ghcr.io/yokingma/weclaws/web:latest');
    expect(prodComposeFile).toContain('build: !reset null');
    expect(prodComposeFile).toContain('pull_policy: always');
    expect(prodComposeFile).toContain('${WECLAWS_DATA_ROOT}/sqlite:/app/storage/sqlite');
    expect(prodComposeFile).toContain(
      '${WECLAWS_DATA_ROOT}/instances:/app/storage/instances',
    );
    expect(prodComposeFile).toContain(
      '${WECLAWS_DATA_ROOT}/sandbox-user-workspaces:/app/apps/sandbox-runtime/user-workspaces',
    );
    expect(prodComposeFile).toContain(
      '${WECLAWS_DATA_ROOT}/sandbox-runtime-private:/app/storage/sandbox-runtime-private',
    );
    expect(
      prodComposeFile.match(/sandbox-runtime-private:\/app\/storage\/sandbox-runtime-private/g),
    ).toHaveLength(3);
    expect(envExample).toContain('WECLAWS_DATA_ROOT=');
  });

  it('preinstalls the expanded CLI baseline in the sandbox image', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/sandbox-runtime.Dockerfile', import.meta.url),
    );
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );
    const [composeFile, dockerfile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(dockerfilePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(dockerfile).toContain('ARG AGENT_BROWSER_NPM_VERSION=0.27.0');
    expect(dockerfile).toContain('ARG BUN_VERSION=1.3.13');
    expect(dockerfile).toContain('ARG LARK_CLI_NPM_VERSION=1.0.32');
    expect(dockerfile).toContain('ARG PNPM_VERSION=9.15.4');
    expect(dockerfile).toContain('ARG UV_VERSION=0.11.7');
    expect(dockerfile).toContain('ffmpeg');
    expect(dockerfile).toContain('file');
    expect(dockerfile).toContain('jq');
    expect(dockerfile).toContain('pandoc');
    expect(dockerfile).toContain('poppler-utils');
    expect(dockerfile).toContain('rm -f /etc/passwd- /etc/shadow- /etc/group- /etc/gshadow-');
    expect(dockerfile).toContain('unzip');
    expect(dockerfile).toContain('zip');
    expect(dockerfile).toContain('npm install -g agent-browser@${AGENT_BROWSER_NPM_VERSION}');
    expect(dockerfile).toContain('npm install -g "@larksuite/cli@${LARK_CLI_NPM_VERSION}"');
    expect(dockerfile).not.toContain('agent-browser install --with-deps');
    expect(dockerfile).not.toContain('chromium');
    expect(dockerfile).not.toContain('AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium');
    expect(dockerfile).toContain('ENV PATH="/usr/local/bin:${PATH}"');
    expect(dockerfile).toContain('ENV SANDBOX_COMMAND_EXTRA_PATHS="/usr/local/bin"');
    expect(dockerfile).toContain(
      'amd64) bun_target="linux-x64-baseline" ;;',
    );
    expect(dockerfile).toContain(
      'arm64) bun_target="linux-aarch64" ;;',
    );
    expect(dockerfile).toContain(
      'https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-${bun_target}.zip',
    );
    expect(dockerfile).not.toContain('/root/.bun/bin');
    expect(dockerfile).toContain('npm install -g pnpm@${PNPM_VERSION}');
    expect(dockerfile).toContain(
      'curl -LsSf https://astral.sh/uv/${UV_VERSION}/install.sh | env UV_UNMANAGED_INSTALL="/usr/local/bin" sh',
    );
    expect(dockerfile).toContain('lark-cli --version');
    expect(composeFile).toContain('LARK_CLI_NPM_VERSION: ${LARK_CLI_NPM_VERSION:-1.0.32}');
    expect(envExample).toContain('# LARK_CLI_NPM_VERSION=1.0.32');
    expect(composeFile).toContain('SANDBOX_COMMAND_EXTRA_PATHS: ${SANDBOX_COMMAND_EXTRA_PATHS:-/usr/local/bin}');
    expect(envExample).toContain('# SANDBOX_COMMAND_EXTRA_PATHS=/usr/local/bin');
  });

  it('passes web runtime env and SRT admin status config into the web container', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const composeFile = await readFile(composePath, 'utf8');

    expect(composeFile).toContain('WEB_ADMIN_EMAILS: ${WEB_ADMIN_EMAILS:-}');
    expect(composeFile).toContain('SRT_POOL_STATUS_FILE: /app/storage/sandbox-runtime-private/srt-pool-status.json');
    expect(composeFile).toContain('- sandbox_runtime_private:/app/storage/sandbox-runtime-private');
    expect(composeFile).not.toContain('FASTAGENT_DEFAULT_PROVIDER: ${FASTAGENT_DEFAULT_PROVIDER:-}');
    expect(composeFile).not.toContain('FASTAGENT_DEFAULT_MODEL: ${FASTAGENT_DEFAULT_MODEL:-}');
    expect(composeFile).not.toContain('FASTAGENT_API_KEY: ${FASTAGENT_API_KEY:-}');
    expect(composeFile).not.toContain('FASTAGENT_BASE_URL: ${FASTAGENT_BASE_URL:-}');
    expect(composeFile).not.toContain('FASTAGENT_API_TYPE: ${FASTAGENT_API_TYPE:-}');
  });

  it('defines a browserless sidecar contract for remote browser automation', async () => {
    const composePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.yml', import.meta.url),
    );
    const prodComposePath = fileURLToPath(
      new URL('../../../../infra/compose/docker-compose.prod.yml', import.meta.url),
    );
    const envExamplePath = fileURLToPath(
      new URL('../../../../infra/compose/.env.example', import.meta.url),
    );

    const [composeFile, prodComposeFile, envExample] = await Promise.all([
      readFile(composePath, 'utf8'),
      readFile(prodComposePath, 'utf8'),
      readFile(envExamplePath, 'utf8'),
    ]);

    expect(composeFile).toContain('browserless:');
    expect(composeFile).toContain('image: ghcr.io/browserless/chromium');
    expect(composeFile).not.toContain('- "${BROWSERLESS_PORT:-3000}:3000"');
    expect(composeFile).toContain('TOKEN: ${BROWSERLESS_TOKEN}');
    expect(composeFile).toContain('CONCURRENT: ${BROWSERLESS_CONCURRENT:-2}');
    expect(composeFile).toContain('QUEUED: ${BROWSERLESS_QUEUED:-2}');
    expect(composeFile).toContain('TIMEOUT: ${BROWSERLESS_TIMEOUT:-120000}');
    expect(composeFile).toContain(
      'BROWSERLESS_API_URL: ${BROWSERLESS_API_URL:-http://browserless:3000}',
    );
    expect(composeFile).toContain('BROWSERLESS_API_KEY: ${BROWSERLESS_TOKEN}');
    expect(prodComposeFile).toContain('browserless:');
    expect(prodComposeFile).toContain('image: ghcr.io/browserless/chromium:latest');
    expect(prodComposeFile).toContain('pull_policy: always');
    expect(envExample).toContain('BROWSERLESS_TOKEN=replace-me');
    expect(envExample).not.toContain('# BROWSERLESS_TOKEN=replace-me');
    expect(envExample).toContain('# BROWSERLESS_API_URL=http://browserless:3000');
    expect(envExample).toContain('# BROWSERLESS_CONCURRENT=2');
    expect(envExample).toContain('# BROWSERLESS_QUEUED=2');
    expect(envExample).toContain('# BROWSERLESS_TIMEOUT=120000');
  });

  it('runs supervisor from compiled output in the Docker image', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/supervisor.Dockerfile', import.meta.url),
    );
    const dockerfile = await readFile(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('COPY resources resources');
    expect(dockerfile).toContain('COPY --from=build /app/resources ./resources');
    expect(dockerfile).toContain('RUN pnpm --filter @weclaws/supervisor build');
    expect(dockerfile).toContain('CMD ["node", "apps/supervisor/dist/index.js"]');
    expect(dockerfile).not.toContain('exec", "tsx", "src/index.ts');
  });

  it('keeps the web runtime image capable of running managed-skills locks and version lookup', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/web.Dockerfile', import.meta.url),
    );
    const dockerfile = await readFile(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('apt-get install -y --no-install-recommends procps');
    expect(dockerfile).toContain('COPY apps/supervisor/package.json apps/supervisor/package.json');
    expect(dockerfile).toContain(
      'COPY --from=build /repo/apps/supervisor/package.json ./apps/supervisor/package.json',
    );
    expect(dockerfile).toContain('COPY resources resources');
    expect(dockerfile).toContain('COPY --from=build /repo/resources ./resources');
    expect(dockerfile).toContain('COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml');
  });

  it('keeps the repo-local fastagent cli version aligned across package metadata and docs', async () => {
    const packageJsonPath = fileURLToPath(
      new URL('../../package.json', import.meta.url),
    );
    const lockfilePath = fileURLToPath(
      new URL('../../../../pnpm-lock.yaml', import.meta.url),
    );
    const contractDocPath = fileURLToPath(
      new URL('../../../../docs/manuals/fastagent-cli-contract.md', import.meta.url),
    );
    const versionMatrixPath = fileURLToPath(
      new URL('../../../../docs/manuals/version-matrix.md', import.meta.url),
    );
    const runbookPath = fileURLToPath(
      new URL('../../../../docs/manuals/docker-deployment-runbook.md', import.meta.url),
    );

    const [packageJson, lockfile, contractDoc, versionMatrix, runbook] =
      await Promise.all([
        readFile(packageJsonPath, 'utf8'),
        readFile(lockfilePath, 'utf8'),
        readFile(contractDocPath, 'utf8'),
        readFile(versionMatrixPath, 'utf8'),
        readFile(runbookPath, 'utf8'),
      ]);

    const fastagentCliVersion = (
      JSON.parse(packageJson) as {
        dependencies?: Record<string, string>;
      }
    ).dependencies?.['@fastagent/cli'];

    expect(fastagentCliVersion).toBeTruthy();
    expect(lockfile).toContain(`specifier: ${fastagentCliVersion}`);
    expect(lockfile).toContain(`@fastagent/cli@${fastagentCliVersion}`);
    expect(contractDoc).toContain(`@fastagent/cli@${fastagentCliVersion}`);
    expect(versionMatrix).toContain(`| \`@fastagent/cli\` | \`${fastagentCliVersion}\` |`);
    expect(runbook).toContain(`repo-local \`@fastagent/cli@${fastagentCliVersion}\``);
  });

  it('preinstalls managed-skill runtime tools in the supervisor image', async () => {
    const dockerfilePath = fileURLToPath(
      new URL('../../../../infra/docker/supervisor.Dockerfile', import.meta.url),
    );
    const dockerfile = await readFile(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('apt-get install -y --no-install-recommends curl gh ffmpeg procps');
  });
});
