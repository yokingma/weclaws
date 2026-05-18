'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';
import type { BotEventItem } from '@/lib/bot-service';

interface BotEventsListProps {
  events: BotEventItem[];
}

const PAGE_SIZE = 10;

export function BotEventsList({ events }: BotEventsListProps) {
  const { locale, t } = useLocale();
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const visibleEvents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [currentPage, events]);

  useEffect(() => {
    setCurrentPage(1);
  }, [events.length, events[0]?.id]);

  return (
    <SectionCard
      contentClassName="grid gap-4"
      title={t((messages) => messages.botDetail.recentEvents)}
    >
      {events.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-5">
          <p className="m-0 text-sm leading-6 text-muted-foreground">{t((messages) => messages.botDetail.noEvents)}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">{currentPage} / {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                {t((messages) => messages.botDetail.eventsPreviousPage)}
              </Button>
              <Button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                {t((messages) => messages.botDetail.eventsNextPage)}
              </Button>
            </div>
          </div>

          <ol className="grid gap-2">
            {visibleEvents.map((event) => (
              <li
                className="grid list-none grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2"
                data-event-row=""
                key={event.id}
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-[color:var(--accent-strong)]/78" />
                <Badge className="max-w-[9rem] truncate" variant="outline">
                  {event.type}
                </Badge>
                <span className="truncate text-sm text-muted-foreground">{event.message}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  <LocalizedDateTime locale={locale} value={event.createdAt} />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </SectionCard>
  );
}
