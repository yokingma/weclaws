import {
  BotEventRepository,
  BotInstanceRepository,
  BotQrShareRepository,
  RegistrationBootstrapClaimRepository,
  RegistrationInviteRepository,
  UserRepository,
  UserLlmProfileRepository,
  UserSandboxRuntimePoolRepository,
  WorkspaceRepository,
  createDatabaseClient,
  type DatabaseClient,
} from '@weclaws/db';
import { getEnv, getWorkspaceRoot } from './env';

export interface WebRepositories {
  users: UserRepository;
  userLlmProfiles: UserLlmProfileRepository;
  userSandboxRuntimePools: UserSandboxRuntimePoolRepository;
  registrationBootstrapClaims: RegistrationBootstrapClaimRepository;
  workspaces: WorkspaceRepository;
  botInstances: BotInstanceRepository;
  botQrShares: BotQrShareRepository;
  botEvents: BotEventRepository;
  registrationInvites: RegistrationInviteRepository;
}

declare global {
  // eslint-disable-next-line no-var
  var __weixinClawsWebDatabaseClient: DatabaseClient | undefined;
}

export function getDatabaseClient(): DatabaseClient {
  if (!globalThis.__weixinClawsWebDatabaseClient) {
    const env = getEnv();
    globalThis.__weixinClawsWebDatabaseClient = createDatabaseClient({
      baseDir: getWorkspaceRoot(),
      url: env.DATABASE_URL,
    });
  }

  return globalThis.__weixinClawsWebDatabaseClient;
}

export function getRepositories(): WebRepositories {
  const client = getDatabaseClient();

  return {
    users: new UserRepository(client.db),
    userLlmProfiles: new UserLlmProfileRepository(client.db),
    userSandboxRuntimePools: new UserSandboxRuntimePoolRepository(client.db),
    registrationBootstrapClaims: new RegistrationBootstrapClaimRepository(client.db),
    workspaces: new WorkspaceRepository(client.db),
    botInstances: new BotInstanceRepository(client.db),
    botQrShares: new BotQrShareRepository(client.db),
    botEvents: new BotEventRepository(client.db),
    registrationInvites: new RegistrationInviteRepository(client.db),
  };
}
