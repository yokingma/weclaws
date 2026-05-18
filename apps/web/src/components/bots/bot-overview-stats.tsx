'use client';

import type { BotSummaryItem } from '@/lib/bot-service';
import { useLocale } from '@/components/providers/locale-provider';
interface BotOverviewStatsProps {
  bots: BotSummaryItem[];
}

export function BotOverviewStats({ bots }: BotOverviewStatsProps) {
  const { t } = useLocale();

  const stats = [
    {
      label: t((messages) => messages.botsList.total),
      value: bots.length,
    },
    {
      label: t((messages) => messages.botsList.running),
      value: bots.filter((bot) => bot.status === 'running').length,
    },
    {
      label: t((messages) => messages.botsList.waitingForQr),
      value: bots.filter((bot) => bot.status === 'waiting_for_qr').length,
    },
    {
      label: t((messages) => messages.botsList.unhealthy),
      value: bots.filter((bot) => bot.status === 'degraded' || bot.status === 'failed').length,
    },
  ];

  return (
    <section
      aria-label={t((messages) => messages.botsList.pageTitle)}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {stats.map((stat) => (
        <div
          className="grid gap-1.5 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 shadow-none"
          key={stat.label}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            {stat.label}
          </span>
          <strong className="text-2xl font-semibold text-foreground">{stat.value}</strong>
        </div>
      ))}
    </section>
  );
}
