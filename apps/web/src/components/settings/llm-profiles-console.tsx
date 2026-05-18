'use client';

import type { FormEvent } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { SectionCard } from '@/components/layout/section-card';
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
import {
  SUPPORTED_LLM_API_TYPES,
  type SupportedLlmApiType,
} from '@/lib/llm-api-types';
import type { LlmProfileItem } from '@/lib/llm-profiles';

interface LlmProfilesConsoleProps {
  profiles: LlmProfileItem[];
}

interface LlmProfileMutationResponse {
  data: {
    profile: LlmProfileItem;
    restartRequestedBotCount: number;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface DeleteLlmProfileResponse {
  data: {
    id: string;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

const NO_API_TYPE = '__none__';

export function LlmProfilesConsole({ profiles }: LlmProfilesConsoleProps) {
  const { t } = useLocale();
  const nameLabel = t((messages) => messages.settings.profileName);
  const providerLabel = t((messages) => messages.settings.provider);
  const modelLabel = t((messages) => messages.settings.model);
  const baseUrlLabel = t((messages) => messages.settings.baseUrl);
  const baseUrlHint = t((messages) => messages.settings.baseUrlDefaultOfficial);
  const apiTypeLabel = t((messages) => messages.settings.apiType);
  const apiKeyLabel = t((messages) => messages.settings.apiKey);
  const apiTypePlaceholder = t((messages) => messages.settings.apiTypeSelectPlaceholder);
  const [profileItems, setProfileItems] = useState(profiles);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiType, setApiType] = useState<SupportedLlmApiType | typeof NO_API_TYPE>(NO_API_TYPE);
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!editingProfileId) {
      return;
    }

    const profile = profileItems.find((item) => item.id === editingProfileId);

    if (!profile) {
      resetForm();
    }
  }, [editingProfileId, profileItems]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitProfile();
  };

  return (
    <div className="grid gap-6">
      <SectionCard
        contentClassName="grid gap-5"
        description={editingProfileId
          ? t((messages) => messages.settings.editorEditDescription)
          : t((messages) => messages.settings.editorCreateDescription)}
        title={editingProfileId
          ? t((messages) => messages.settings.editorEditTitle)
          : t((messages) => messages.settings.editorCreateTitle)}
      >
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <FieldLabel field="name" label={nameLabel} required />
              <Input
                aria-label={nameLabel}
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <FieldLabel field="provider" label={providerLabel} required />
              <Input
                aria-label={providerLabel}
                name="provider"
                onChange={(event) => setProvider(event.target.value)}
                required
                type="text"
                value={provider}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <FieldLabel field="model" label={modelLabel} required />
              <Input
                aria-label={modelLabel}
                name="model"
                onChange={(event) => setModel(event.target.value)}
                required
                type="text"
                value={model}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <div className="grid gap-1">
                <FieldLabel field="baseUrl" label={baseUrlLabel} />
                <p className="m-0 text-xs font-normal leading-5 text-[color:var(--text-soft)]">
                  {baseUrlHint}
                </p>
              </div>
              <Input
                aria-label={baseUrlLabel}
                name="baseUrl"
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={t((messages) => messages.settings.optionalBlank)}
                type="text"
                value={baseUrl}
              />
            </Label>

            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <FieldLabel field="apiType" label={apiTypeLabel} required />
              <Select onValueChange={(value) => setApiType(value as SupportedLlmApiType)} value={apiType}>
                <SelectTrigger aria-label={apiTypeLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem disabled value={NO_API_TYPE}>
                    {apiTypePlaceholder}
                  </SelectItem>
                  {SUPPORTED_LLM_API_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>

          <div className="grid gap-3 rounded-[1.35rem] border border-[color:var(--border-soft)]/80 bg-[color:var(--surface-muted)]/80 p-4">
            <Label className="grid gap-2.5 text-sm font-medium text-foreground">
              <FieldLabel field="apiKey" label={apiKeyLabel} required={!editingProfileId} />
              <div className="relative">
                <Input
                  aria-label={apiKeyLabel}
                  className="pr-12"
                  name="apiKey"
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={editingProfileId
                    ? t((messages) => messages.settings.apiKeyKeepCurrent)
                    : undefined}
                  required={!editingProfileId}
                  type={isApiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                />
                <button
                  aria-label={isApiKeyVisible
                    ? t((messages) => messages.settings.hideApiKey)
                    : t((messages) => messages.settings.showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)] transition-colors hover:text-foreground"
                  onClick={() => setIsApiKeyVisible((previous) => !previous)}
                  type="button"
                >
                  {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Label>
            {editingProfileId ? (
              <p className="m-0 text-xs text-[color:var(--text-soft)]">
                {t((messages) => messages.settings.apiKeyKeepCurrent)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={isPending} type="submit">
              {editingProfileId
                ? (isPending
                  ? t((messages) => messages.settings.savePending)
                  : t((messages) => messages.settings.saveChanges))
                : (isPending
                  ? t((messages) => messages.settings.createPending)
                  : t((messages) => messages.settings.createProfile))}
            </Button>
            {editingProfileId ? (
              <Button disabled={isPending} onClick={resetForm} type="button" variant="outline">
                {t((messages) => messages.settings.cancel)}
              </Button>
            ) : null}
          </div>
        </form>

        {successMessage ? (
          <p className="m-0 text-sm text-[color:var(--status-success)]">{successMessage}</p>
        ) : null}
        {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}
      </SectionCard>

      <SectionCard
        contentClassName="grid gap-3"
        description={t((messages) => messages.settings.listDescription)}
        title={t((messages) => messages.settings.listTitle)}
      >
        {profileItems.length === 0 ? (
          <p className="m-0 rounded-[1.2rem] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/65 px-4 py-6 text-sm text-muted-foreground">
            {t((messages) => messages.settings.empty)}
          </p>
        ) : (
          profileItems.map((profile) => (
            <article
              className="grid gap-3 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3"
              data-llm-profile-row=""
              key={profile.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <strong className="text-base font-semibold tracking-[0.02em] text-foreground">{profile.name}</strong>
                  <p className="m-0 text-sm text-muted-foreground">
                    {profile.provider} / {profile.model}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => startEditing(profile)} type="button" variant="outline">
                    {t((messages) => messages.settings.edit)}
                  </Button>
                  <Button onClick={() => deleteProfile(profile.id)} type="button" variant="destructive">
                    {t((messages) => messages.settings.deleteProfile)}
                  </Button>
                </div>
              </div>

              <Separator />

              <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ProfileMetadata
                  label={t((messages) => messages.settings.baseUrl)}
                  value={profile.baseUrl ?? t((messages) => messages.common.unavailable)}
                />
                <ProfileMetadata
                  label={t((messages) => messages.settings.apiType)}
                  value={profile.apiType ?? t((messages) => messages.settings.apiTypeUnset)}
                />
                <ProfileMetadata
                  label={t((messages) => messages.settings.apiKey)}
                  value={profile.hasApiKey
                    ? t((messages) => messages.settings.apiKeyConfigured)
                    : t((messages) => messages.settings.apiKeyMissing)}
                />
              </dl>
            </article>
          ))
        )}
      </SectionCard>
    </div>
  );

  function startEditing(profile: LlmProfileItem) {
    setEditingProfileId(profile.id);
    setName(profile.name);
    setProvider(profile.provider);
    setModel(profile.model);
    setBaseUrl(profile.baseUrl ?? '');
    setApiType(toApiTypeValue(profile.apiType));
    setApiKey('');
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function resetForm() {
    setEditingProfileId(null);
    setName('');
    setProvider('');
    setModel('');
    setBaseUrl('');
    setApiType(NO_API_TYPE);
    setApiKey('');
    setIsApiKeyVisible(false);
  }

  function submitProfile() {
    setErrorMessage(null);
    setSuccessMessage(null);
    const payload = buildProfilePayload();

    if (!payload) {
      return;
    }

    const profileId = editingProfileId;
    const url = profileId ? `/api/settings/llm-profiles/${profileId}` : '/api/settings/llm-profiles';
    const method = profileId ? 'PATCH' : 'POST';

    startTransition(async () => {
      try {
        const response = await fetch(url, {
          body: JSON.stringify(payload),
          headers: {
            'content-type': 'application/json',
          },
          method,
        });
        const result = (await response.json()) as LlmProfileMutationResponse;

        if (!response.ok || !result.data) {
          setErrorMessage(result.error?.message ?? t((messages) => messages.settings.saveFailed));
          return;
        }

        const nextProfile = result.data.profile;

        setProfileItems((currentItems) => {
          const remaining = currentItems.filter((item) => item.id !== nextProfile.id);
          return [nextProfile, ...remaining];
        });
        resetForm();
        setSuccessMessage(result.data.restartRequestedBotCount > 0
          ? t((messages) => messages.settings.restartRequested)({
            count: result.data.restartRequestedBotCount,
          })
          : profileId
            ? t((messages) => messages.settings.saveSuccess)
            : t((messages) => messages.settings.createSuccess));
      } catch {
        setErrorMessage(t((messages) => messages.settings.saveFailed));
      }
    });
  }

  function deleteProfile(profileId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/settings/llm-profiles/${profileId}`, {
          method: 'DELETE',
        });
        const result = (await response.json()) as DeleteLlmProfileResponse;

        if (!response.ok || !result.data) {
          setErrorMessage(result.error?.message ?? t((messages) => messages.settings.deleteFailed));
          return;
        }

        setProfileItems((currentItems) => currentItems.filter((item) => item.id !== result.data?.id));
        if (editingProfileId === profileId) {
          resetForm();
        }
      } catch {
        setErrorMessage(t((messages) => messages.settings.deleteFailed));
      }
    });
  }

  function buildProfilePayload() {
    if (apiType === NO_API_TYPE) {
      setErrorMessage(t((messages) => messages.settings.apiTypeRequired));
      return null;
    }

    const payload = {
      apiType,
      baseUrl: normalizeOptionalText(baseUrl),
      model: model.trim(),
      name: name.trim(),
      provider: provider.trim(),
    } satisfies Record<string, string | null>;

    if (!editingProfileId) {
      return {
        ...payload,
        apiKey: apiKey.trim(),
      };
    }

    return apiKey.trim()
      ? {
        ...payload,
        apiKey: apiKey.trim(),
      }
      : payload;
  }
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toApiTypeValue(value: string | null): SupportedLlmApiType | typeof NO_API_TYPE {
  if (value && SUPPORTED_LLM_API_TYPES.includes(value as SupportedLlmApiType)) {
    return value as SupportedLlmApiType;
  }

  return NO_API_TYPE;
}

interface FieldLabelProps {
  field: string;
  label: string;
  required?: boolean;
}

function FieldLabel({ field, label, required = false }: FieldLabelProps) {
  return (
    <span data-llm-profile-label={field}>
      {label}
      {required ? <RequiredIndicator /> : null}
    </span>
  );
}

function RequiredIndicator() {
  return (
    <span aria-hidden="true" className="text-[color:var(--text-soft)]" data-required-indicator="">
      {' *'}
    </span>
  );
}

interface ProfileMetadataProps {
  label: string;
  value: string;
}

function ProfileMetadata({ label, value }: ProfileMetadataProps) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</dt>
      <dd className="m-0 text-sm text-foreground">{value}</dd>
    </div>
  );
}
