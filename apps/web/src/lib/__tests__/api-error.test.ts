import { describe, expect, it } from 'vitest';
import { ApiError, fail } from '../api-error';

describe('api error normalization', () => {
  it('preserves explicit ApiError responses', async () => {
    const response = fail(new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Bot not found.',
      },
    });
  });

  it('folds plain error-like objects into the generic internal error', async () => {
    const response = fail({
      code: 'SQLITE_CONSTRAINT',
      message: 'constraint failed at /private/tmp/weclaws/test.sqlite',
      status: 409,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error.',
      },
    });
  });
});
