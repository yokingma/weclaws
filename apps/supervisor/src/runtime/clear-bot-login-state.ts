import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveBotInstancePaths } from '@weclaws/shared';

const FASTAGENT_LOGIN_STATE_FILES = [
  'accounts-roster.jsonl',
  'accounts-runtime.jsonl',
  'bindings.jsonl',
] as const;

export interface ClearBotLoginStateInput {
  botInstanceId: string;
  instancesRoot: string;
}

export async function clearBotLoginState(input: ClearBotLoginStateInput) {
  const { dataDir } = resolveBotInstancePaths(input.instancesRoot, input.botInstanceId);

  await Promise.all(
    FASTAGENT_LOGIN_STATE_FILES.map((fileName) => rm(join(dataDir, fileName), { force: true })),
  );
}
