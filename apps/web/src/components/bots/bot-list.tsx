'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';
import {
  getDesiredStatePresentation,
  getRuntimeStatusPresentation,
  type PresentationTone,
} from '@/lib/bot-status-presentation';
import type { BotSummaryItem } from '@/lib/bot-service';
import { BotRenameControl } from './bot-rename-control';

interface BotListProps {
  bots: BotSummaryItem[];
  onBotUpdated(bot: BotSummaryItem): void;
}

export function BotList({ bots, onBotUpdated }: BotListProps) {
  const { t } = useLocale();

  return (
    <div className="grid gap-2">
      <div className="hidden rounded-[var(--radius-panel)] border border-transparent px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)] xl:grid xl:grid-cols-[minmax(12rem,1.35fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_minmax(12rem,1fr)_minmax(10rem,0.8fr)_auto]">
        <span>{t((messages) => messages.botsList.inventoryLabel)}</span>
        <span>{t((messages) => messages.botsList.runtimeColumn)}</span>
        <span>{t((messages) => messages.botsList.desiredColumn)}</span>
        <span>{t((messages) => messages.botsList.modelColumn)}</span>
        <span>{t((messages) => messages.botsList.workspace)}</span>
        <span>{t((messages) => messages.botsList.open)}</span>
      </div>
      <ul aria-label={t((messages) => messages.botsList.inventoryLabel)} className="grid gap-2">
        {bots.map((bot) => (
          <BotListItem
            bot={bot}
            key={bot.id}
            onBotUpdated={onBotUpdated}
            openLabel={t((messages) => messages.botsList.open)}
            unavailableLabel={t((messages) => messages.common.unavailable)}
            workspaceLabel={t((messages) => messages.botsList.workspace)}
          />
        ))}
      </ul>
    </div>
  );
}

interface BotListItemProps {
  bot: BotSummaryItem;
  onBotUpdated(bot: BotSummaryItem): void;
  openLabel: string;
  unavailableLabel: string;
  workspaceLabel: string;
}

function BotListItem({
  bot,
  onBotUpdated,
  openLabel,
  unavailableLabel,
  workspaceLabel,
}: BotListItemProps) {
  const { locale, t } = useLocale();
  const runtimePresentation = getRuntimeStatusPresentation(bot.status, locale);
  const desiredPresentation = getDesiredStatePresentation(bot.desiredState, locale);

  return (
    <li className="list-none" data-bot-inventory-row="">
      <div className="grid gap-3 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 xl:grid-cols-[minmax(12rem,1.35fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_minmax(12rem,1fr)_minmax(10rem,0.8fr)_auto] xl:items-center">
        <div className="grid gap-1.5">
          <BotRenameControl bot={bot} onBotUpdated={onBotUpdated} />
          <RecencyText
            bot={bot}
            locale={locale}
            unavailableLabel={unavailableLabel}
            createdLabel={t((messages) => messages.botsList.created)}
            updatedLabel={t((messages) => messages.botsList.updated)}
          />
        </div>

        <div>
          <Badge variant={toBadgeVariant(runtimePresentation.tone)}>{runtimePresentation.label}</Badge>
        </div>

        <div>
          <Badge variant={toBadgeVariant(desiredPresentation.tone)}>{desiredPresentation.label}</Badge>
        </div>

        <div className="grid gap-0.5 text-sm">
          <span className="font-medium text-foreground">{bot.provider}</span>
          <span className="text-muted-foreground">{bot.model}</span>
        </div>

        <div className="grid gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)] xl:hidden">
            {workspaceLabel}
          </span>
          <span className="break-all font-mono text-[13px] text-[color:var(--text-soft)]">
            {bot.workspaceId}
          </span>
        </div>

        <Button asChild className="justify-center" size="sm" variant="outline">
          <Link href={`/bots/${bot.id}`}>{openLabel}</Link>
        </Button>
      </div>
    </li>
  );

}

interface RecencyTextProps {
  bot: BotSummaryItem;
  locale: string;
  updatedLabel: string;
  createdLabel: string;
  unavailableLabel: string;
}

function RecencyText({
  bot,
  locale,
  updatedLabel,
  createdLabel,
  unavailableLabel,
}: RecencyTextProps) {
  const value = bot.updatedAt || bot.createdAt;
  const label = bot.updatedAt ? updatedLabel : createdLabel;

  return (
    <span className="text-sm text-muted-foreground">
      {label}:{' '}
      <LocalizedDateTime locale={locale} unavailableLabel={unavailableLabel} value={value} />
    </span>
  );
}

function toBadgeVariant(tone: PresentationTone) {
  if (tone === 'success') {
    return 'success';
  }

  if (tone === 'attention') {
    return 'warning';
  }

  if (tone === 'danger') {
    return 'danger';
  }

  return 'neutral';
}
