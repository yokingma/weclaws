// @vitest-environment jsdom

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalizedDateTime } from '../localized-date-time';

describe('LocalizedDateTime', () => {
  const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat');

  afterEach(() => {
    dateTimeFormatSpy.mockReset();
  });

  it('renders a stable server snapshot and localizes after hydration', async () => {
    dateTimeFormatSpy.mockImplementation((function DateTimeFormatMock(
      locale: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      return {
        format: () => options?.timeZone === 'UTC'
          ? 'Mar 30, 2026, 10:18 UTC'
          : 'Mar 30, 2026, 18:18 Local',
      };
    }) as unknown as typeof Intl.DateTimeFormat);

    const serverMarkup = renderToString(
      <LocalizedDateTime
        locale="en"
        unavailableLabel="Unavailable"
        value="2026-03-30T10:18:19.068Z"
      />
    );

    expect(serverMarkup).toContain('Mar 30, 2026, 10:18 UTC');

    render(
      <LocalizedDateTime
        locale="en"
        unavailableLabel="Unavailable"
        value="2026-03-30T10:18:19.068Z"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mar 30, 2026, 18:18 Local')).toBeInTheDocument();
    });
  });
});
