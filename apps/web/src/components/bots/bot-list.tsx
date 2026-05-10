'use client';

import Link from 'next/link';
import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const { locale, t } = useLocale();

  return (
    <ul className="grid gap-3">
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
    <li className="list-none">
      <Card className="border-[color:var(--border-soft)] bg-[color:var(--surface)]/94">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <BotRenameControl bot={bot} onBotUpdated={onBotUpdated} />
                <Badge variant={toBadgeVariant(runtimePresentation.tone)}>{runtimePresentation.label}</Badge>
                <Badge variant={toBadgeVariant(desiredPresentation.tone)}>{desiredPresentation.label}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {bot.provider} / {bot.model}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>
                <RecencyText
                  bot={bot}
                  locale={locale}
                  unavailableLabel={unavailableLabel}
                  createdLabel={t((messages) => messages.botsList.created)}
                  updatedLabel={t((messages) => messages.botsList.updated)}
                />
              </span>
              <span className="font-mono text-[13px] text-[color:var(--text-soft)]">
                {workspaceLabel}: {bot.workspaceId}
              </span>
            </div>
          </div>

          <Button asChild className="justify-center" variant="outline">
            <Link href={`/bots/${bot.id}`}>{openLabel}</Link>
          </Button>
        </CardContent>
      </Card>
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
    <>
      {label}:{' '}
      <LocalizedDateTime locale={locale} unavailableLabel={unavailableLabel} value={value} />
    </>
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
