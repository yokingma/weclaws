'use client';

import { useEffect, useState } from 'react';
import { normalizeTrustedQrCodeUrl } from '@weclaws/shared';
import { useLocale } from '@/components/providers/locale-provider';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';

interface PublicQrShareViewProps {
  token: string;
}

interface PublicQrSharePayload {
  qrCodeUrl: string | null;
  shareId: string;
  status: string;
  updatedAt: string;
}

interface PublicQrShareResponse {
  data: PublicQrSharePayload | null;
  error: {
    code: string;
    message: string;
  } | null;
}

const POLL_INTERVAL_MS = 2_000;

export function PublicQrShareView({ token }: PublicQrShareViewProps) {
  const { locale, t } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<PublicQrSharePayload | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/share/qr/${token}`, {
          cache: 'no-store',
        });
        const nextPayload = (await response.json()) as PublicQrShareResponse;

        if (isCancelled) {
          return;
        }

        if (!response.ok || !nextPayload.data) {
          setPayload(null);
          setErrorMessage(nextPayload.error?.message ?? t((messages) => messages.botDetail.noQrDescription));
          return;
        }

        setPayload(nextPayload.data);
        setErrorMessage(null);
      } catch {
        if (!isCancelled) {
          setErrorMessage(t((messages) => messages.botDetail.noQrDescription));
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [t, token]);

  const trustedQrCodeUrl = normalizeTrustedQrCodeUrl(payload?.qrCodeUrl ?? null);
  const qrPreviewUrl = trustedQrCodeUrl ? `/api/qrcode?value=${encodeURIComponent(trustedQrCodeUrl)}` : null;

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-3xl content-center gap-6 px-6 py-10">
      <div className="grid gap-3 rounded-[1.65rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/92 p-6 shadow-[var(--shadow-panel)]">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
          WeClaws
        </p>
        <h1 className="m-0 text-3xl font-semibold text-foreground">
          {t((messages) => messages.botDetail.qrCode)}
        </h1>
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          {trustedQrCodeUrl
            ? t((messages) => messages.botDetail.qrPreviewDescription)
            : t((messages) => messages.botDetail.noQrDescription)}
        </p>
      </div>

      <div className="grid gap-4 rounded-[1.65rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/92 p-6 shadow-[var(--shadow-panel)]">
        {qrPreviewUrl ? (
          <div className="grid place-items-center rounded-[1.4rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
            <img
              alt={payload?.shareId ?? 'Weixin QR code'}
              className="w-full max-w-[320px] rounded-[1.2rem] border border-[color:var(--border-soft)] bg-white"
              src={qrPreviewUrl}
            />
          </div>
        ) : (
          <div className="grid gap-2 rounded-[1.25rem] border border-dashed border-[color:var(--border-strong)]/75 bg-[color:var(--surface-muted)]/72 px-5 py-6">
            <strong className="text-base font-semibold text-foreground">{t((messages) => messages.botDetail.noQrTitle)}</strong>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              {errorMessage ?? t((messages) => messages.botDetail.noQrDescription)}
            </p>
          </div>
        )}

        <div className="grid gap-2 text-sm text-muted-foreground">
          <p className="m-0">
            {t((messages) => messages.botDetail.statusLabel)}: <span className="text-foreground">{payload?.status ?? unavailableLabel(t)}</span>
          </p>
          <p className="m-0">
            {t((messages) => messages.botsList.updated)}:{' '}
            <LocalizedDateTime
              locale={locale}
              unavailableLabel={unavailableLabel(t)}
              value={payload?.updatedAt ?? null}
            />
          </p>
        </div>
      </div>
    </section>
  );
}

function unavailableLabel(t: ReturnType<typeof useLocale>['t']) {
  return t((messages) => messages.common.unavailable);
}
