'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/error-notice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { BotCreationQuota } from '@/lib/bot-service';
import type { LlmProfileItem } from '@/lib/llm-profiles';

interface CreateBotResponse {
  data: {
    id: string;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface CreateBotFormProps {
  profiles: LlmProfileItem[];
  quota: BotCreationQuota;
}

function RequiredIndicator() {
  return (
    <span aria-hidden="true" className="text-[color:var(--text-soft)]" data-required-indicator="">
      {' *'}
    </span>
  );
}

export function CreateBotForm({ profiles, quota }: CreateBotFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const nameLabel = t((messages) => messages.createBot.name);
  const unavailableLabel = t((messages) => messages.common.unavailable);
  const [llmProfileId, setLlmProfileId] = useState(profiles[0]?.id ?? '');
  const selectedProfile = profiles.find((profile) => profile.id === llmProfileId) ?? null;
  const isRuntimeConfigComplete = Boolean(
    selectedProfile?.provider && selectedProfile?.model && selectedProfile?.hasApiKey,
  );
  const quotaSummary = quota.limit === null
    ? t((messages) => messages.botQuota.summaryUnlimited)({ usedCount: quota.usedCount })
    : t((messages) => messages.botQuota.summaryLimited)({
      limit: quota.limit,
      remainingCount: quota.remainingCount ?? 0,
      usedCount: quota.usedCount,
    });
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/bots', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            llmProfileId,
            name,
          }),
        });

        const payload = (await response.json()) as CreateBotResponse;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.createBot.failed));
          return;
        }

        router.push(`/bots/${payload.data.id}`);
        router.refresh();
      } catch {
        setErrorMessage(t((messages) => messages.createBot.failed));
      }
    });
  };

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div
        className="grid gap-5 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 shadow-none"
        data-create-bot-panel=""
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <h2 className="m-0 text-lg font-semibold text-foreground">
              {t((messages) => messages.createBot.basicInfo)}
            </h2>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              {t((messages) => messages.createBot.basicInfoHelper)}
            </p>
            <p className="m-0 text-sm leading-6 text-muted-foreground">{quotaSummary}</p>
          </div>

          <Label className="grid gap-2.5 text-sm font-medium text-foreground">
            <span data-create-bot-label="">
              {nameLabel}
              <RequiredIndicator />
            </span>
            <Input
              aria-label={nameLabel}
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder={t((messages) => messages.createBot.namePlaceholder)}
              required
              type="text"
              value={name}
            />
          </Label>

          <Label className="grid gap-2.5 text-sm font-medium text-foreground">
            {t((messages) => messages.createBot.llmProfile)}
            <Select onValueChange={setLlmProfileId} value={llmProfileId}>
              <SelectTrigger aria-label={t((messages) => messages.createBot.llmProfile)}>
                <SelectValue placeholder={t((messages) => messages.createBot.noProfiles)} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        </div>

        <Separator />

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <h2 className="m-0 text-lg font-semibold text-foreground">
              {t((messages) => messages.createBot.runtimeConfig)}
            </h2>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              {t((messages) => messages.createBot.runtimeHelper)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              {t((messages) => messages.createBot.provider)}
              <Input
                name="provider"
                readOnly
                type="text"
                value={selectedProfile?.provider ?? unavailableLabel}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              {t((messages) => messages.createBot.model)}
              <Input
                name="model"
                readOnly
                type="text"
                value={selectedProfile?.model ?? unavailableLabel}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              {t((messages) => messages.createBot.baseUrl)}
              <Input
                name="baseUrl"
                placeholder={t((messages) => messages.createBot.providerDefault)}
                readOnly
                type="text"
                value={selectedProfile?.baseUrl ?? ''}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              {t((messages) => messages.createBot.apiType)}
              <Input
                name="apiType"
                placeholder={t((messages) => messages.createBot.providerDefault)}
                readOnly
                type="text"
                value={selectedProfile?.apiType ?? ''}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              {t((messages) => messages.createBot.apiKeyStatus)}
              <Input
                name="apiKeyStatus"
                readOnly
                type="text"
                value={selectedProfile?.hasApiKey
                  ? t((messages) => messages.createBot.apiKeyConfigured)
                  : t((messages) => messages.createBot.apiKeyMissing)}
              />
            </Label>
          </div>

          {!selectedProfile ? (
            <ErrorNotice>
              {t((messages) => messages.createBot.noProfiles)}{' '}
              <Link className="font-medium underline underline-offset-4" href="/settings">
                {t((messages) => messages.createBot.openSettings)}
              </Link>
            </ErrorNotice>
          ) : null}

          {selectedProfile && !isRuntimeConfigComplete ? (
            <ErrorNotice>
              {t((messages) => messages.createBot.runtimeIncomplete)}{' '}
              <Link className="font-medium underline underline-offset-4" href="/settings">
                {t((messages) => messages.createBot.openSettings)}
              </Link>
            </ErrorNotice>
          ) : null}

          {quota.isAtLimit && quota.limit !== null ? (
            <ErrorNotice>
              {t((messages) => messages.botQuota.limitReached)({ limit: quota.limit })}
            </ErrorNotice>
          ) : null}
        </div>
      </div>

      <div
        className="grid gap-4 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        data-create-bot-submit-strip=""
      >
        <p className="m-0 text-sm leading-6 text-muted-foreground">{t((messages) => messages.createBot.intro)}</p>
        <Button
          className="sm:min-w-[12rem]"
          disabled={isPending || !selectedProfile || !isRuntimeConfigComplete || quota.isAtLimit}
          size="lg"
          type="submit"
        >
          {isPending ? t((messages) => messages.createBot.createPending) : t((messages) => messages.createBot.create)}
        </Button>
      </div>

      {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
    </form>
  );
}
