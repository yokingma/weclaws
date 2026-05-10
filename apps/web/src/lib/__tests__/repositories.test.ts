import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createDatabaseClientMock = vi.fn();

class UserRepositoryMock {
  constructor(readonly db: object) {}
}

class UserLlmProfileRepositoryMock {
  constructor(readonly db: object) {}
}

class RegistrationBootstrapClaimRepositoryMock {
  constructor(readonly db: object) {}
}

class WorkspaceRepositoryMock {
  constructor(readonly db: object) {}

  deleteById() {
    return Promise.resolve(true);
  }
}

class BotInstanceRepositoryMock {
  constructor(readonly db: object) {}
}

class BotQrShareRepositoryMock {
  constructor(readonly db: object) {}
}

class BotEventRepositoryMock {
  constructor(readonly db: object) {}
}

class RegistrationInviteRepositoryMock {
  constructor(readonly db: object) {}
}

class UserSandboxRuntimePoolRepositoryMock {
  constructor(readonly db: object) {}
}

vi.mock('@weclaws/db', () => ({
  BotEventRepository: BotEventRepositoryMock,
  BotInstanceRepository: BotInstanceRepositoryMock,
  BotQrShareRepository: BotQrShareRepositoryMock,
  RegistrationBootstrapClaimRepository: RegistrationBootstrapClaimRepositoryMock,
  RegistrationInviteRepository: RegistrationInviteRepositoryMock,
  UserLlmProfileRepository: UserLlmProfileRepositoryMock,
  UserRepository: UserRepositoryMock,
  UserSandboxRuntimePoolRepository: UserSandboxRuntimePoolRepositoryMock,
  WorkspaceRepository: WorkspaceRepositoryMock,
  createDatabaseClient: createDatabaseClientMock,
}));

vi.mock('../env', () => ({
  getEnv: () => ({
    APP_BASE_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'secret',
    DATABASE_URL: 'file:./storage/sqlite/db.sqlite',
  }),
  getWorkspaceRoot: () => '/tmp/weclaws',
}));

describe('getRepositories', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.__weixinClawsWebDatabaseClient = {
      close: () => {},
      connection: {} as never,
      db: {} as never,
      url: 'file:./storage/sqlite/db.sqlite',
    };
    (globalThis as { __weixinClawsWebRepositories?: unknown }).__weixinClawsWebRepositories = {
      workspaces: {},
    };
  });

  afterEach(() => {
    globalThis.__weixinClawsWebDatabaseClient = undefined;
    (globalThis as { __weixinClawsWebRepositories?: unknown }).__weixinClawsWebRepositories = undefined;
  });

  it('rebuilds repository instances instead of reusing stale globals across hot reloads', async () => {
    const { getRepositories } = await import('../repositories');

    const repositories = getRepositories();

    expect(repositories.workspaces).toBeInstanceOf(WorkspaceRepositoryMock);
    expect(typeof repositories.workspaces.deleteById).toBe('function');
    expect(repositories.botQrShares).toBeInstanceOf(BotQrShareRepositoryMock);
    expect(repositories.userSandboxRuntimePools).toBeInstanceOf(UserSandboxRuntimePoolRepositoryMock);
  });
});
