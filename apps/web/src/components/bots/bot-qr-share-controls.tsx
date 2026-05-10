'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/error-notice';

interface BotQrShareControlsProps {
  botId: string;
  disabled: boolean;
  onPendingChange(isPending: boolean): void;
}

interface BotQrShareResponse {
  data: {
    publicUrl: string;
    revokedAt: string | null;
    shareId: string;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

type QrShareAction = 'disable-qr-share' | 'enable-qr-share';

export function BotQrShareControls({ botId, disabled, onPendingChange }: BotQrShareControlsProps) {
  const { t } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<QrShareAction | null>(null);
  const [qrShare, setQrShare] = useState<BotQrShareResponse['data']>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDisabled = disabled || isPending;

  useEffect(() => {
    onPendingChange(isPending);
  }, [isPending, onPendingChange]);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/bots/${botId}/qr-share`);
        const payload = (await response.json()) as BotQrShareResponse;

        if (isCancelled) {
          return;
        }

        if (!response.ok || !payload.data || typeof payload.data.publicUrl !== 'string') {
          setQrShare(null);
          return;
        }

        setQrShare(payload.data);
      } catch {
        if (!isCancelled) {
          setQrShare(null);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [botId]);

  return (
    <div className="grid gap-3 rounded-[1.2rem] border border-[color:var(--border-soft)]/85 bg-[color:var(--surface-muted)]/72 px-4 py-4">
      <p className="m-0 text-xs text-[color:var(--text-soft)]">
        {t((messages) => messages.botDetail.qrShareDescription)}
      </p>
      {qrShare?.publicUrl ? (
        <p className="m-0 break-all rounded-[1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 font-mono text-sm text-foreground">
          {qrShare.publicUrl}
        </p>
      ) : null}
      {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
      {shareMessage ? (
        <p
          aria-live="polite"
          className="rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/72 px-4 py-3 text-sm text-[color:var(--text-soft)]"
        >
          {shareMessage}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="w-full"
          disabled={isDisabled}
          onClick={qrShare?.publicUrl ? disableQrShare : enableQrShare}
          type="button"
          variant="outline"
        >
          {qrShare?.publicUrl
            ? getQrShareActionLabel(
                'disable-qr-share',
                isPending,
                pendingAction,
                t((messages) => messages.botDetail.disableQrShare),
              )
            : getQrShareActionLabel(
                'enable-qr-share',
                isPending,
                pendingAction,
                t((messages) => messages.botDetail.enableQrShare),
              )}
        </Button>
        <Button
          className="w-full"
          disabled={!qrShare?.publicUrl || isDisabled}
          onClick={() => {
            void copyQrShareLink();
          }}
          type="button"
          variant="outline"
        >
          {t((messages) => messages.botDetail.copyQrShareLink)}
        </Button>
      </div>
    </div>
  );

  function enableQrShare() {
    runQrShareMutation('enable-qr-share', 'POST');
  }

  function disableQrShare() {
    runQrShareMutation('disable-qr-share', 'DELETE');
  }

  function runQrShareMutation(action: QrShareAction, method: 'DELETE' | 'POST') {
    setErrorMessage(null);
    setShareMessage(null);
    setPendingAction(action);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${botId}/qr-share`, { method });
        const payload = (await response.json()) as BotQrShareResponse;

        if (!response.ok) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.qrShareFailed));
          return;
        }

        if (method === 'DELETE') {
          setQrShare(null);
          setShareMessage(t((messages) => messages.botDetail.qrShareDisabled));
          return;
        }

        if (!payload.data) {
          setErrorMessage(t((messages) => messages.botDetail.qrShareFailed));
          return;
        }

        setQrShare(payload.data);
        setShareMessage(t((messages) => messages.botDetail.qrShareCreated));
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.qrShareFailed));
      } finally {
        setPendingAction(null);
      }
    });
  }

  async function copyQrShareLink() {
    if (!qrShare?.publicUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setShareMessage(t((messages) => messages.botDetail.qrShareCopyUnavailable));
      return;
    }

    try {
      await navigator.clipboard.writeText(qrShare.publicUrl);
      setShareMessage(t((messages) => messages.botDetail.qrShareCopied));
    } catch {
      setShareMessage(t((messages) => messages.botDetail.qrShareCopyUnavailable));
    }
  }
}

function getQrShareActionLabel(
  action: QrShareAction,
  isPending: boolean,
  pendingAction: QrShareAction | null,
  label: string,
) {
  if (isPending && pendingAction === action) {
    return `${label}...`;
  }

  return label;
}
