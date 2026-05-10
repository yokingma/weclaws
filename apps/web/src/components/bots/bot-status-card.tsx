'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/components/providers/locale-provider';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/error-notice';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';
import type { BotDetailItem } from '@/lib/bot-service';
import { BotQrShareControls } from './bot-qr-share-controls';
import { QrCodePanel } from './qr-code-panel';

interface BotStatusCardProps {
  bot: BotDetailItem;
  onBotUpdated(bot: BotDetailItem): void;
}

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

type BotAction =
  | 'delete'
  | 'reissue-qr'
  | 'restart'
  | 'start'
  | 'stop'
  | 'sync-skills';

export function BotStatusCard({ bot, onBotUpdated }: BotStatusCardProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isQrSharePending, setIsQrSharePending] = useState(false);
  const [pendingAction, setPendingAction] = useState<BotAction | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isActionDisabled = isPending || isQrSharePending;
  const unavailable = t((messages) => messages.common.unavailable);
  const canDeleteBot = bot.desiredState === 'stopped' && bot.status === 'stopped' && bot.processPid === null;
  const shouldShowQr = bot.status === 'waiting_for_qr';

  const runCommand = (action: BotAction) => {
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
  };

  const runDelete = () => {
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
  };

  const runSkillsSync = () => {
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
  };

  const runQrReissue = () => {
    setErrorMessage(null);
    setSyncMessage(null);
    setPendingAction('reissue-qr');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${bot.id}/reissue-qr`, {
          method: 'POST',
        });
        const payload = (await response.json()) as BotCommandResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.reissueQrFailed));
          return;
        }

        onBotUpdated(payload.data);
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.reissueQrFailed));
      } finally {
        setPendingAction(null);
      }
    });
  };

  const rows = [
    {
      label: t((messages) => messages.botDetail.processStarted),
      value: <LocalizedDateTime locale={locale} unavailableLabel={unavailable} value={bot.processStartedAt} />,
    },
  ];

  return (
    <SectionCard
      contentClassName="grid gap-4"
      title={t((messages) => messages.botDetail.runtimeSummary)}
    >
      <div className="grid gap-4">
        <QrCodePanel
          embedded
          qrCodeId={shouldShowQr ? bot.lastQrCodeId : null}
          qrCodeUrl={shouldShowQr ? bot.lastQrCodeUrl : null}
        />

        <div className="grid gap-2">
          {rows.map((row) => (
            <div
              className="grid gap-1 rounded-[1.2rem] border border-[color:var(--border-soft)]/80 bg-[color:var(--surface-muted)]/72 px-4 py-2.5"
              key={row.label}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                {row.label}
              </span>
              <span className="text-sm text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
        {syncMessage ? (
          <p
            aria-live="polite"
            className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/72 px-4 py-3 text-sm text-[color:var(--text-soft)]"
          >
            {syncMessage}
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" disabled={isActionDisabled} onClick={() => runCommand('start')} type="button">
            {getActionLabel('start', isPending, pendingAction, t((messages) => messages.botDetail.start))}
          </Button>
          <Button className="w-full" disabled={isActionDisabled} onClick={() => runCommand('stop')} type="button" variant="muted">
            {getActionLabel('stop', isPending, pendingAction, t((messages) => messages.botDetail.stop))}
          </Button>
          <Button
            className="w-full"
            disabled={isActionDisabled}
            onClick={() => runCommand('restart')}
            type="button"
            variant="outline"
          >
            {getActionLabel('restart', isPending, pendingAction, t((messages) => messages.botDetail.restart))}
          </Button>
          <Button
            className="w-full"
            disabled={isActionDisabled}
            onClick={runQrReissue}
            type="button"
            variant="outline"
          >
            {getActionLabel(
              'reissue-qr',
              isPending,
              pendingAction,
              t((messages) => messages.botDetail.reissueQr),
            )}
          </Button>
          <Button
            className="w-full"
            disabled={isActionDisabled}
            onClick={runSkillsSync}
            type="button"
            variant="outline"
          >
            {getActionLabel(
              'sync-skills',
              isPending,
              pendingAction,
              t((messages) => messages.botDetail.syncSkills),
            )}
          </Button>
        </div>

        <p className="text-xs text-[color:var(--text-soft)]">
          {t((messages) => messages.botDetail.syncSkillsNotice)}
        </p>

        <BotQrShareControls
          botId={bot.id}
          disabled={isPending}
          onPendingChange={setIsQrSharePending}
        />

        <div className="grid gap-3 rounded-[1.2rem] border border-destructive/20 bg-destructive/5 px-4 py-4">
          <p className="m-0 text-xs text-[color:var(--text-soft)]">
            {t((messages) => messages.botDetail.deleteNotice)}
          </p>
          {isDeleteConfirming ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="w-full"
                disabled={isActionDisabled || !canDeleteBot}
                onClick={runDelete}
                type="button"
                variant="destructive"
              >
                {getActionLabel(
                  'delete',
                  isPending,
                  pendingAction,
                  t((messages) => messages.botDetail.confirmDelete),
                )}
              </Button>
              <Button
                className="w-full"
                disabled={isActionDisabled}
                onClick={() => setIsDeleteConfirming(false)}
                type="button"
                variant="outline"
              >
                {t((messages) => messages.botDetail.cancelDelete)}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={isActionDisabled || !canDeleteBot}
              onClick={() => setIsDeleteConfirming(true)}
              type="button"
              variant="destructive"
            >
              {t((messages) => messages.botDetail.delete)}
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function getActionLabel(action: BotAction, isPending: boolean, pendingAction: BotAction | null, label: string) {
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
