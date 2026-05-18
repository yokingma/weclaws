'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import type { AdminInviteItem } from '@/lib/admin-invites';
import { useLocale } from '@/components/providers/locale-provider';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/error-notice';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';

interface AdminInvitesConsoleProps {
  invites: AdminInviteItem[];
}

interface CreateInviteResponse {
  data: AdminInviteItem | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export function AdminInvitesConsole({ invites }: AdminInvitesConsoleProps) {
  const { locale, t } = useLocale();
  const [inviteItems, setInviteItems] = useState(invites);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerateInvite = () => {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/invites', {
          method: 'POST',
        });
        const payload = (await response.json()) as CreateInviteResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.adminInvites.generateFailed));
          return;
        }

        setInviteItems((currentItems) => [payload.data as AdminInviteItem, ...currentItems]);
      } catch {
        setErrorMessage(t((messages) => messages.adminInvites.generateFailed));
      }
    });
  };

  const handleDeleteInvite = (inviteId: string) => {
    setErrorMessage(null);
    setPendingDeleteId(inviteId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/invites/${inviteId}`, {
          method: 'DELETE',
        });
        const payload = (await response.json()) as {
          data: { id: string } | null;
          error: { code: string; message: string } | null;
        };

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.adminInvites.deleteFailed));
          return;
        }

        setInviteItems((currentItems) => currentItems.filter((item) => item.id !== payload.data?.id));
      } catch {
        setErrorMessage(t((messages) => messages.adminInvites.deleteFailed));
      } finally {
        setPendingDeleteId(null);
      }
    });
  };

  return (
    <div className="grid gap-6">
      <SectionCard
        className="overflow-hidden"
        contentClassName="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        description={t((messages) => messages.adminInvites.policy)}
        title={t((messages) => messages.adminInvites.controlTitle)}
      >
        <p className="m-0 max-w-2xl text-sm leading-7 text-muted-foreground">
          {t((messages) => messages.adminInvites.description)}
        </p>
        <Button disabled={isPending} onClick={handleGenerateInvite} size="lg" type="button">
          {isPending ? t((messages) => messages.adminInvites.generatePending) : t((messages) => messages.adminInvites.generate)}
        </Button>
      </SectionCard>

      {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}

      <SectionCard
        contentClassName="grid gap-3"
        description={t((messages) => messages.adminInvites.listDescription)}
        title={t((messages) => messages.adminInvites.listTitle)}
      >
        {inviteItems.length === 0 ? (
          <p className="m-0 rounded-[1.2rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/65 px-4 py-6 text-sm text-muted-foreground">
            {t((messages) => messages.adminInvites.empty)}
          </p>
        ) : (
          inviteItems.map((invite) => (
            <article
              className="grid gap-3 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3"
              data-invite-audit-row=""
              key={invite.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                    {t((messages) => messages.adminInvites.codeLabel)}
                  </span>
                  <strong className="text-base font-semibold tracking-[0.02em] text-foreground">{invite.code}</strong>
                </div>
                <span className="inline-flex h-8 items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  {invite.usedAt
                    ? t((messages) => messages.adminInvites.statusUsed)
                    : invite.reservedAt
                      ? t((messages) => messages.adminInvites.statusReserved)
                      : t((messages) => messages.adminInvites.statusAvailable)}
                </span>
              </div>

              <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.createdAtLabel)}
                  value={<LocalizedDateTime locale={locale} value={invite.createdAt} />}
                />
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.createdByLabel)}
                  value={invite.createdByEmail}
                />
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.reservedAtLabel)}
                  value={invite.reservedAt
                    ? <LocalizedDateTime locale={locale} value={invite.reservedAt} />
                    : t((messages) => messages.common.unavailable)}
                />
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.reservedByLabel)}
                  value={invite.reservedByEmail ?? t((messages) => messages.common.unavailable)}
                />
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.usedAtLabel)}
                  value={invite.usedAt
                    ? <LocalizedDateTime locale={locale} value={invite.usedAt} />
                    : t((messages) => messages.common.unavailable)}
                />
                <InviteMetadata
                  label={t((messages) => messages.adminInvites.usedByLabel)}
                  value={invite.usedByEmail ?? t((messages) => messages.common.unavailable)}
                />
              </dl>

              <div className="flex justify-end">
                <Button
                  disabled={!invite.canDelete || (isPending && pendingDeleteId === invite.id)}
                  onClick={() => handleDeleteInvite(invite.id)}
                  type="button"
                  variant="destructive"
                >
                  {isPending && pendingDeleteId === invite.id
                    ? t((messages) => messages.adminInvites.deletePending)
                    : t((messages) => messages.adminInvites.delete)}
                </Button>
              </div>
            </article>
          ))
        )}
      </SectionCard>
    </div>
  );
}

interface InviteMetadataProps {
  label: string;
  value: ReactNode;
}

function InviteMetadata({ label, value }: InviteMetadataProps) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</dt>
      <dd className="m-0 text-sm text-foreground">{value}</dd>
    </div>
  );
}
