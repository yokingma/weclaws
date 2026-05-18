'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ErrorNotice } from '@/components/ui/error-notice';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';
import type { BotDetailItem } from '@/lib/bot-service';
import {
  getDesiredStatePresentation,
  getRuntimeStatusPresentation,
  type PresentationTone,
} from '@/lib/bot-status-presentation';
import type { LlmProfileItem } from '@/lib/llm-profiles';
import { BotConfirmActionButton } from './bot-confirm-action-button';
import { BotLlmProfileCard } from './bot-llm-profile-card';

interface BotDetailHeaderProps {
  bot: BotDetailItem;
  onBotUpdated(bot: BotDetailItem): void;
  profiles: LlmProfileItem[];
}

type HeaderAction =
  | 'delete'
  | 'restart'
  | 'start'
  | 'stop'
  | 'sync-skills';
type BotRuntimeCommandAction = 'restart' | 'start' | 'stop';

interface BotCommandResponse {
  data: BotDetailItem | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface DeleteBotResponse {
  data: {
    id: string;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface SyncSkillsResponse {
  data: {
    result: {
      error: {
        code: string;
        message: string;
      } | null;
      skippedConflicts: string[];
      status: 'busy' | 'error' | 'success';
    };
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export function BotDetailHeader({ bot, onBotUpdated, profiles }: BotDetailHeaderProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<HeaderAction | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const runtimePresentation = getRuntimeStatusPresentation(bot.status, locale);
  const desiredPresentation = getDesiredStatePresentation(bot.desiredState, locale);
  const unavailable = t((messages) => messages.common.unavailable);
  const isActionDisabled = isPending;
  const canDeleteBot =
    bot.desiredState === 'stopped' && bot.status === 'stopped' && bot.processPid === null;

  const runtimeRows = [
    {
      label: t((messages) => messages.botDetail.statusLabel),
      value: runtimePresentation.label,
    },
    {
      label: t((messages) => messages.botDetail.desiredStateLabel),
      value: desiredPresentation.label,
    },
    {
      label: t((messages) => messages.botDetail.lastHeartbeat),
      value: <LocalizedDateTime locale={locale} unavailableLabel={unavailable} value={bot.heartbeatAt} />,
    },
    {
      label: t((messages) => messages.botDetail.processState),
      value: bot.processPid === null ? unavailable : `PID ${bot.processPid}`,
    },
    {
      label: t((messages) => messages.botDetail.processStarted),
      value: <LocalizedDateTime locale={locale} unavailableLabel={unavailable} value={bot.processStartedAt} />,
    },
    {
      label: t((messages) => messages.botDetail.latestError),
      value: formatError(bot, unavailable),
    },
  ];

  const metadataRows = [
    {
      label: t((messages) => messages.botDetail.workspaceId),
      value: bot.workspaceId || unavailable,
    },
    {
      label: t((messages) => messages.botDetail.weixinAccount),
      value: bot.weixinAccountId || unavailable,
    },
    {
      label: t((messages) => messages.botDetail.restartRequested),
      value: <LocalizedDateTime locale={locale} unavailableLabel={unavailable} value={bot.restartRequestedAt} />,
    },
    {
      label: t((messages) => messages.botDetail.errorCode),
      value: bot.lastErrorCode || unavailable,
    },
  ];

  return (
    <section className="grid gap-4 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 shadow-none">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid gap-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            {t((messages) => messages.botDetail.headerDescription)}
          </p>
          <h2 className="m-0 text-2xl font-semibold text-foreground lg:text-3xl">{bot.name}</h2>
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            {bot.provider} / {bot.model}
          </p>
        </div>

        <div
          aria-label={t((messages) => messages.botDetail.headerActionsRegion)}
          className="grid gap-3 lg:justify-items-end"
          role="region"
        >
          <div className="flex flex-wrap gap-2.5 lg:justify-end">
            <Badge variant={toBadgeVariant(runtimePresentation.tone)}>{runtimePresentation.label}</Badge>
            <Badge variant={toBadgeVariant(desiredPresentation.tone)}>{desiredPresentation.label}</Badge>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              disabled={isActionDisabled}
              onClick={() => runCommand('start')}
              size="sm"
              type="button"
            >
              {getActionLabel('start', isPending, pendingAction, t((messages) => messages.botDetail.start))}
            </Button>
            <BotConfirmActionButton
              actionLabel={t((messages) => messages.botDetail.stop)}
              cancelLabel={t((messages) => messages.botDetail.cancelDelete)}
              confirmLabel={t((messages) => messages.botDetail.confirmAction({
                action: messages.botDetail.stop,
              }))}
              disabled={isActionDisabled}
              description={t((messages) => messages.botDetail.confirmActionDescription({
                action: messages.botDetail.stop,
              }))}
              isPending={isPending && pendingAction === 'stop'}
              onConfirm={() => runCommand('stop')}
              size="sm"
              variant="muted"
            />
            <BotConfirmActionButton
              actionLabel={t((messages) => messages.botDetail.restart)}
              cancelLabel={t((messages) => messages.botDetail.cancelDelete)}
              confirmLabel={t((messages) => messages.botDetail.confirmAction({
                action: messages.botDetail.restart,
              }))}
              disabled={isActionDisabled}
              description={t((messages) => messages.botDetail.confirmActionDescription({
                action: messages.botDetail.restart,
              }))}
              isPending={isPending && pendingAction === 'restart'}
              onConfirm={() => runCommand('restart')}
              size="sm"
              variant="outline"
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={isActionDisabled} size="sm" type="button" variant="outline">
                  {t((messages) => messages.botDetail.profileAction)}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(92vw,40rem)]">
                <div className="grid gap-2 pr-8">
                  <DialogTitle>{t((messages) => messages.botDetail.llmProfileTitle)}</DialogTitle>
                  <DialogDescription>{t((messages) => messages.botDetail.llmProfileDescription)}</DialogDescription>
                </div>
                <BotLlmProfileCard
                  bot={bot}
                  embedded
                  onBotUpdated={onBotUpdated}
                  profiles={profiles}
                />
              </DialogContent>
            </Dialog>
            <BotConfirmActionButton
              actionLabel={t((messages) => messages.botDetail.syncSkills)}
              cancelLabel={t((messages) => messages.botDetail.cancelDelete)}
              confirmLabel={t((messages) => messages.botDetail.confirmAction({
                action: messages.botDetail.syncSkills,
              }))}
              disabled={isActionDisabled}
              description={t((messages) => messages.botDetail.syncSkillsNotice)}
              isPending={isPending && pendingAction === 'sync-skills'}
              onConfirm={runSkillsSync}
              size="sm"
              variant="outline"
            />
            <BotConfirmActionButton
              actionLabel={t((messages) => messages.botDetail.delete)}
              cancelLabel={t((messages) => messages.botDetail.cancelDelete)}
              confirmLabel={t((messages) => messages.botDetail.confirmAction({
                action: messages.botDetail.delete,
              }))}
              disabled={isActionDisabled || !canDeleteBot}
              description={t((messages) => messages.botDetail.deleteNotice)}
              isPending={isPending && pendingAction === 'delete'}
              onConfirm={runDelete}
              size="sm"
              variant="destructive"
            />
          </div>

          {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
          {syncMessage ? (
            <p
              aria-live="polite"
              className="m-0 max-w-[34rem] rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-soft)]"
            >
              {syncMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="grid gap-4 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        data-bot-detail-summary=""
      >
        <div className="grid gap-4">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            {t((messages) => messages.botDetail.currentRuntimeStatus)}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {runtimeRows.map((row) => (
              <div className="grid gap-1" key={row.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  {row.label}
                </dt>
                <dd className="m-0 text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid gap-4 border-t border-[color:var(--border-soft)] pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
            {t((messages) => messages.botDetail.metadata)}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {metadataRows.map((row) => (
              <div className="grid gap-1" key={row.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  {row.label}
                </dt>
                <dd className="m-0 break-all font-mono text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );

  function runCommand(action: BotRuntimeCommandAction) {
    setErrorMessage(null);
    setSyncMessage(null);
    setPendingAction(action);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${bot.id}/${action}`, {
          method: 'POST',
        });
        const payload = (await response.json()) as BotCommandResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.commandFailed));
          return;
        }

        onBotUpdated(payload.data);
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.commandFailed));
      } finally {
        setPendingAction(null);
      }
    });
  }

  function runDelete() {
    setErrorMessage(null);
    setSyncMessage(null);
    setPendingAction('delete');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${bot.id}`, {
          method: 'DELETE',
        });
        const payload = (await response.json()) as DeleteBotResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.deleteFailed));
          return;
        }

        router.push('/bots');
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.deleteFailed));
      } finally {
        setPendingAction(null);
      }
    });
  }

  function runSkillsSync() {
    setErrorMessage(null);
    setSyncMessage(null);
    setPendingAction('sync-skills');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${bot.id}/skills/sync`, {
          method: 'POST',
        });
        const payload = (await response.json()) as SyncSkillsResponse;
        const result = payload.data?.result;

        if (result) {
          setSyncMessage(buildSyncMessage(result, locale, t((messages) => messages.botDetail.syncSkillsSuccess)));
          return;
        }

        setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.syncSkillsFailed));
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.syncSkillsFailed));
      } finally {
        setPendingAction(null);
      }
    });
  }
}

function formatError(bot: BotDetailItem, unavailableLabel: string) {
  if (!bot.lastErrorCode && !bot.lastErrorMessage) {
    return unavailableLabel;
  }

  if (bot.lastErrorCode && bot.lastErrorMessage) {
    return `${bot.lastErrorCode}: ${bot.lastErrorMessage}`;
  }

  return bot.lastErrorCode ?? bot.lastErrorMessage ?? unavailableLabel;
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

function getActionLabel(action: HeaderAction, isPending: boolean, pendingAction: HeaderAction | null, label: string) {
  if (isPending && pendingAction === action) {
    return `${label}...`;
  }

  return label;
}

function buildSyncMessage(
  result: {
    error: {
      code: string;
      message: string;
    } | null;
    skippedConflicts: string[];
    status: 'busy' | 'error' | 'success';
  },
  locale: string,
  successLabel: string,
) {
  if (result.status === 'busy') {
    return locale === 'zh-CN'
      ? '当前已有同步任务进行中。'
      : 'A sync is already in progress.';
  }

  if (result.status === 'error') {
    return locale === 'zh-CN'
      ? 'Skills 同步失败，但不会阻断当前 Bot 运行。'
      : 'Managed skills sync failed, but the bot can keep running.';
  }

  if (result.skippedConflicts.length === 0) {
    return successLabel;
  }

  if (locale === 'zh-CN') {
    return `${successLabel} 已保留 ${result.skippedConflicts.length} 个用户同名 skill。`;
  }

  return `${successLabel} ${result.skippedConflicts.length} conflicting user skill was kept.`;
}
