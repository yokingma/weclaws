import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const RESTORED_ACCOUNT_ID = 'restored_acc_1';
const TRUSTED_QR_CODE_URL = 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=81617e3de8b98a196dd0842c26bdba4b&bot_type=3';

export type ScriptedFastAgentScenario =
  | 'invalid_json'
  | 'missing_qr_url'
  | 'restored_crash'
  | 'restored_happy'
  | 'stateful_restore_or_qr'
  | 'startup_crash';

export async function createScriptedFastAgentBinary(
  dir: string,
  scenario: ScriptedFastAgentScenario,
) {
  const binaryPath = join(dir, `fastagent-${scenario}.mjs`);

const source = `#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const agentId = process.env.IM_GATEWAY_AGENT_ID ?? 'bot_unknown';
const dataDir = process.env.IM_GATEWAY_DATA_DIR ?? process.cwd();
const pid = process.pid;
const scenario = ${JSON.stringify(scenario)};
const STEP_DELAY_MS = 10;
let stopping = false;
let keepAliveTimer = null;
const TRUSTED_QR_CODE_URL = ${JSON.stringify(TRUSTED_QR_CODE_URL)};
const RESTORED_ACCOUNT_ID = ${JSON.stringify(RESTORED_ACCOUNT_ID)};

function emit(type, message, data) {
  process.stdout.write(JSON.stringify({
    agentId,
    data,
    message,
    pid,
    timestamp: new Date().toISOString(),
    type,
  }) + '\\n');
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function stopGracefully(reason) {
  if (stopping) {
    return;
  }

  stopping = true;
  emit('stopping', 'IM runtime stopping', { reason });
  await delay(STEP_DELAY_MS);
  emit('stopped', 'IM runtime stopped', {
    exitCode: reason === 'runtime_error' ? 1 : 0,
    reason,
  });

  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
  }

  process.exit(reason === 'runtime_error' ? 1 : 0);
}

process.on('SIGINT', () => {
  void stopGracefully('signal');
});

process.on('SIGTERM', () => {
  void stopGracefully('signal');
});

async function main() {
  emit('process_started', 'IM runtime process started', {
    channel: 'weixin',
  });
  await delay(STEP_DELAY_MS);

  if (scenario === 'startup_crash') {
    await delay(STEP_DELAY_MS);
    emit('runtime_error', 'IM runtime failed', {
      error: 'Sandbox session crashed before steady state',
    });
    await delay(STEP_DELAY_MS);
    await stopGracefully('runtime_error');
    return;
  }

  if (scenario === 'invalid_json') {
    await delay(STEP_DELAY_MS);
    process.stdout.write('this is not valid jsonl\\n');
    keepAliveTimer = setInterval(() => {
      // Wait for the supervisor to terminate the runtime after invalid output.
    }, 60_000);
    return;
  }

  if (scenario === 'missing_qr_url') {
    await delay(STEP_DELAY_MS);
    emit('qr_code', 'IM runtime emitted an incomplete QR payload', {});
    keepAliveTimer = setInterval(() => {
      // Wait for the supervisor to terminate the runtime after the malformed event.
    }, 60_000);
    return;
  }

  if (scenario === 'stateful_restore_or_qr') {
    if (await hasLoginState()) {
      emit('running', 'IM runtime entered steady state', {
        accountId: RESTORED_ACCOUNT_ID,
        source: 'restored',
      });
    } else {
      emit('qr_code', 'Weixin QR code ready', {
        qrCodeId: 'reissue_qr_1',
        qrCodeUrl: TRUSTED_QR_CODE_URL,
      });
    }

    keepAliveTimer = setInterval(() => {
      // Keep the scripted runtime alive until it receives a stop signal.
    }, 60_000);
    return;
  }

  emit('running', 'IM runtime entered steady state', {
    accountId: RESTORED_ACCOUNT_ID,
    source: 'restored',
  });

  if (scenario === 'restored_crash') {
    await delay(STEP_DELAY_MS);
    emit('runtime_error', 'IM runtime failed', {
      error: 'Sandbox session crashed unexpectedly',
    });
    await delay(STEP_DELAY_MS);
    await stopGracefully('runtime_error');
    return;
  }

  keepAliveTimer = setInterval(() => {
    // Keep the scripted runtime alive until it receives a stop signal.
  }, 60_000);
}

void main().catch(async (error) => {
  emit('runtime_error', 'IM runtime failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  await stopGracefully('runtime_error');
});

async function hasLoginState() {
  const files = [
    'accounts-roster.jsonl',
    'accounts-runtime.jsonl',
    'bindings.jsonl',
  ];

  for (const file of files) {
    try {
      await access(join(dataDir, file));
      return true;
    } catch {
      // Continue checking the remaining state files.
    }
  }

  return false;
}
`;

  await writeFile(binaryPath, source);
  await chmod(binaryPath, 0o755);

  return binaryPath;
}
