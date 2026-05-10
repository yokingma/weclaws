'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/error-notice';
import { Input } from '@/components/ui/input';
import type { BotSummaryItem } from '@/lib/bot-service';

interface BotRenameControlProps {
  bot: BotSummaryItem;
  onBotUpdated(bot: BotSummaryItem): void;
}

interface UpdateBotResponse {
  data: BotSummaryItem | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export function BotRenameControl({ bot, onBotUpdated }: BotRenameControlProps) {
  const { t } = useLocale();
  const [draftName, setDraftName] = useState(bot.name);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const trimmedDraftName = draftName.trim();
  const canSubmit = Boolean(trimmedDraftName) && trimmedDraftName !== bot.name.trim() && !isPending;
  const nameLabel = t((messages) => messages.botDetail.botNameLabel);

  useEffect(() => {
    setDraftName(bot.name);
  }, [bot.name]);

  if (!isEditing) {
    return (
      <button
        className="text-left text-xl font-semibold tracking-[-0.02em] text-foreground transition-colors hover:text-primary"
        onClick={() => {
          setDraftName(bot.name);
          setErrorMessage(null);
          setIsEditing(true);
        }}
        type="button"
      >
        {bot.name}
      </button>
    );
  }

  return (
    <div className="grid min-w-[14rem] flex-1 gap-2">
      <form className="flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
        <Input
          aria-label={nameLabel}
          autoFocus
          className="min-w-[14rem] flex-1"
          name="name"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              resetRename();
            }
          }}
          required
          type="text"
          value={draftName}
        />
        <Button aria-label={t((messages) => messages.botDetail.saveBotInfo)} disabled={!canSubmit} size="icon" type="submit">
          <Check className="h-4 w-4" />
        </Button>
        <Button
          aria-label={t((messages) => messages.botDetail.cancelDelete)}
          disabled={isPending}
          onClick={resetRename}
          size="icon"
          type="button"
          variant="outline"
        >
          <X className="h-4 w-4" />
        </Button>
      </form>
      {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
    </div>
  );

  function resetRename() {
    setDraftName(bot.name);
    setErrorMessage(null);
    setIsEditing(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/bots/${bot.id}`, {
          body: JSON.stringify({ name: trimmedDraftName }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'PATCH',
        });
        const payload = (await response.json()) as UpdateBotResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.botDetail.saveBotInfoFailed));
          return;
        }

        onBotUpdated(payload.data);
        setDraftName(payload.data.name);
        setIsEditing(false);
      } catch {
        setErrorMessage(t((messages) => messages.botDetail.saveBotInfoFailed));
      }
    });
  }
}
