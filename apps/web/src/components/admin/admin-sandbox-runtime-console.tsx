'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Activity, Cpu, KeyRound, MemoryStick, PencilLine, Power, RotateCw, Save } from 'lucide-react';
import { SectionCard } from '@/components/layout/section-card';
import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorNotice } from '@/components/ui/error-notice';
import { Input } from '@/components/ui/input';
import { LocalizedDateTime } from '@/components/ui/localized-date-time';
import type {
  AdminSandboxRuntimePoolItem,
  AdminSandboxRuntimePoolsPayload,
} from '@/lib/sandbox-runtime-admin';

interface AdminSandboxRuntimeConsoleProps {
  initialData: AdminSandboxRuntimePoolsPayload;
}

interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface PoolEditorState {
  enabled: boolean;
  healthCheckIntervalMs: string;
  maxConcurrentInit: string;
  minReadyProcesses: string;
  poolSize: string;
  port: string;
  portRangeEnd: string;
  portRangeStart: string;
  sessionTimeoutMs: string;
}

type FieldName = keyof Omit<PoolEditorState, 'enabled'>;
type FieldErrors = Partial<Record<FieldName, string>>;
interface ValidationMessages {
  minReadyProcessesExceedsPoolSize: string;
  portRangeStartExceedsEnd: string;
  positiveInteger: string;
}

type PendingAction = {
  ownerUserId: string;
  type: 'restart' | 'save' | 'toggle';
} | null;

const EDITABLE_FIELD_NAMES: readonly FieldName[] = [
  'poolSize',
  'minReadyProcesses',
  'maxConcurrentInit',
  'healthCheckIntervalMs',
  'sessionTimeoutMs',
  'port',
  'portRangeStart',
  'portRangeEnd',
];

export function AdminSandboxRuntimeConsole({ initialData }: AdminSandboxRuntimeConsoleProps) {
  const { locale, t } = useLocale();
  const [data, setData] = useState(initialData);
  const [editors, setEditors] = useState(() => createEditorStateByOwner(initialData.pools));
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrors>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editingOwnerUserId, setEditingOwnerUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unavailableLabel = t((messages) => messages.adminSandboxRuntime.unavailable);
  const editLabel = t((messages) => messages.adminSandboxRuntime.editPool);
  const validationMessages: ValidationMessages = {
    minReadyProcessesExceedsPoolSize: t((messages) => messages.adminSandboxRuntime.minReadyProcessesExceedsPoolSize),
    portRangeStartExceedsEnd: t((messages) => messages.adminSandboxRuntime.portRangeStartExceedsEnd),
    positiveInteger: t((messages) => messages.adminSandboxRuntime.positiveInteger),
  };
  const selectedPool = editingOwnerUserId
    ? data.pools.find((pool) => pool.ownerUserId === editingOwnerUserId) ?? null
    : null;
  const selectedEditor = selectedPool ? editors[selectedPool.ownerUserId] : null;
  const selectedFieldErrors = selectedPool ? (fieldErrors[selectedPool.ownerUserId] ?? {}) : {};
  const selectedOwnerLabel = selectedPool ? selectedPool.ownerEmail ?? selectedPool.ownerUserId : '';

  useEffect(() => {
    setData(initialData);
    setEditors(createEditorStateByOwner(initialData.pools));
    setFieldErrors({});
  }, [initialData]);

  const updateEditor = (ownerUserId: string, patch: Partial<PoolEditorState>) => {
    setEditors((currentEditors) => ({
      ...currentEditors,
      [ownerUserId]: {
        ...currentEditors[ownerUserId],
        ...patch,
      },
    }));
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [ownerUserId]: {
        ...currentErrors[ownerUserId],
        ...clearPatchedFieldErrors(patch),
      },
    }));
  };

  const mergePool = (ownerUserId: string, patch: Partial<AdminSandboxRuntimePoolItem>) => {
    setData((currentData) => ({
      ...currentData,
      pools: currentData.pools.map((pool) => (
        pool.ownerUserId === ownerUserId
          ? {
            ...pool,
            ...patch,
            ownerEmail: patch.ownerEmail ?? pool.ownerEmail,
            runtime: patch.runtime ?? pool.runtime,
          }
          : pool
      )),
    }));
  };

  const openEditor = (ownerUserId: string) => {
    setEditingOwnerUserId(ownerUserId);
    setErrorMessage(null);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [ownerUserId]: {},
    }));
  };

  const closeEditor = () => {
    setEditingOwnerUserId(null);
    setErrorMessage(null);
  };

  const handleRestart = (ownerUserId: string) => {
    setErrorMessage(null);
    setPendingAction({ ownerUserId, type: 'restart' });

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/sandbox-runtime/pools/${ownerUserId}/restart`, {
          method: 'POST',
        });
        const payload = await response.json() as ApiResponse<{
          ownerUserId: string;
          restartRequestedAt: string | null;
        }>;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.adminSandboxRuntime.commandFailed));
          return;
        }

        mergePool(ownerUserId, {
          restartRequestedAt: payload.data.restartRequestedAt,
        });
      } catch {
        setErrorMessage(t((messages) => messages.adminSandboxRuntime.commandFailed));
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSave = (pool: AdminSandboxRuntimePoolItem) => {
    const editor = editors[pool.ownerUserId];
    const parsed = parseEditorState(editor, validationMessages);

    if (!parsed.success) {
      setErrorMessage(null);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [pool.ownerUserId]: parsed.fieldErrors,
      }));
      return;
    }

    setErrorMessage(null);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [pool.ownerUserId]: {},
    }));
    setPendingAction({ ownerUserId: pool.ownerUserId, type: 'save' });

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/sandbox-runtime/pools/${pool.ownerUserId}`, {
          body: JSON.stringify(parsed.data),
          headers: {
            'content-type': 'application/json',
          },
          method: 'PATCH',
        });
        const payload = await response.json() as ApiResponse<AdminSandboxRuntimePoolItem>;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.adminSandboxRuntime.commandFailed));
          return;
        }

        mergePool(pool.ownerUserId, payload.data);
        setEditors((currentEditors) => ({
          ...currentEditors,
          [pool.ownerUserId]: toEditorState({
            ...pool,
            ...payload.data,
          }),
        }));
        setEditingOwnerUserId(null);
      } catch {
        setErrorMessage(t((messages) => messages.adminSandboxRuntime.commandFailed));
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleToggle = (pool: AdminSandboxRuntimePoolItem) => {
    const editor = {
      ...editors[pool.ownerUserId],
      enabled: !editors[pool.ownerUserId].enabled,
    };
    const parsed = parseEditorState(editor, validationMessages);

    if (!parsed.success) {
      setErrorMessage(null);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [pool.ownerUserId]: parsed.fieldErrors,
      }));
      return;
    }

    setErrorMessage(null);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [pool.ownerUserId]: {},
    }));
    setPendingAction({ ownerUserId: pool.ownerUserId, type: 'toggle' });

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/sandbox-runtime/pools/${pool.ownerUserId}`, {
          body: JSON.stringify(parsed.data),
          headers: {
            'content-type': 'application/json',
          },
          method: 'PATCH',
        });
        const payload = await response.json() as ApiResponse<AdminSandboxRuntimePoolItem>;

        if (!response.ok || !payload.data) {
          setErrorMessage(payload.error?.message ?? t((messages) => messages.adminSandboxRuntime.commandFailed));
          return;
        }

        mergePool(pool.ownerUserId, payload.data);
        setEditors((currentEditors) => ({
          ...currentEditors,
          [pool.ownerUserId]: toEditorState({
            ...pool,
            ...payload.data,
          }),
        }));
      } catch {
        setErrorMessage(t((messages) => messages.adminSandboxRuntime.commandFailed));
      } finally {
        setPendingAction(null);
      }
    });
  };

  return (
    <div className="grid gap-6">
      <SectionCard
        contentClassName="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        title={t((messages) => messages.adminSandboxRuntime.managerTitle)}
      >
        {data.manager ? (
          <>
            <ResourceMetric
              icon={<Activity className="h-4 w-4" />}
              label={t((messages) => messages.adminSandboxRuntime.state)}
              value={data.manager.state}
            />
            <ResourceMetric
              icon={<Cpu className="h-4 w-4" />}
              label={t((messages) => messages.adminSandboxRuntime.cpu)}
              value={formatPercent(data.manager.cpuPercent, unavailableLabel)}
            />
            <ResourceMetric
              icon={<MemoryStick className="h-4 w-4" />}
              label={t((messages) => messages.adminSandboxRuntime.memory)}
              value={formatBytes(data.manager.rssBytes, unavailableLabel)}
            />
            <ResourceMetric
              label={t((messages) => messages.adminSandboxRuntime.runningPools)}
              value={`${data.manager.runningPoolCount ?? 0} / ${data.manager.managedPoolCount ?? 0}`}
            />
            <ResourceMetric
              label={t((messages) => messages.adminSandboxRuntime.totalPoolSize)}
              value={String(data.manager.totalPoolSize ?? 0)}
            />
          </>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {t((messages) => messages.adminSandboxRuntime.statusFileUnavailable)}
          </p>
        )}
      </SectionCard>

      {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}

      <SectionCard
        contentClassName="grid gap-3"
        description={t((messages) => messages.adminSandboxRuntime.poolsDescription)}
        title={t((messages) => messages.adminSandboxRuntime.poolsTitle)}
      >
        {data.pools.map((pool) => {
          const ownerLabel = pool.ownerEmail ?? pool.ownerUserId;

          return (
            <article
              className="grid gap-3 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_auto] md:items-center"
              data-srt-pool-row=""
              key={pool.ownerUserId}
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base font-semibold text-foreground">{ownerLabel}</strong>
                  <Badge variant={pool.enabled ? 'success' : 'neutral'}>
                    {pool.enabled
                      ? t((messages) => messages.adminSandboxRuntime.enabled)
                      : t((messages) => messages.adminSandboxRuntime.disabled)}
                  </Badge>
                  <Badge variant={pool.runtime?.state === 'running' ? 'success' : 'neutral'}>
                    {pool.runtime?.state ?? t((messages) => messages.adminSandboxRuntime.runtimeUnavailable)}
                  </Badge>
                  {pool.apiKeyConfigured ? (
                    <Badge variant="outline">
                      <KeyRound className="mr-1 h-3 w-3" />
                      {t((messages) => messages.adminSandboxRuntime.apiKeyConfigured)}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-sm text-muted-foreground">{pool.ownerUserId}</span>
              </div>

              <dl className="grid grid-cols-3 gap-3 text-sm">
                <PoolMetric
                  label={t((messages) => messages.adminSandboxRuntime.port)}
                  value={String(pool.port)}
                />
                <PoolMetric
                  label={t((messages) => messages.adminSandboxRuntime.cpu)}
                  value={formatPercent(pool.runtime?.cpuPercent ?? null, unavailableLabel)}
                />
                <PoolMetric
                  label={t((messages) => messages.adminSandboxRuntime.memory)}
                  value={formatBytes(pool.runtime?.rssBytes ?? null, unavailableLabel)}
                />
              </dl>

              <div className="flex justify-end">
                <Button
                  aria-label={editLabel}
                  onClick={() => openEditor(pool.ownerUserId)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PencilLine className="h-4 w-4" />
                  {editLabel}
                </Button>
              </div>
            </article>
          );
        })}
      </SectionCard>

      <Dialog onOpenChange={(open) => {
        if (!open) {
          closeEditor();
        }
      }} open={selectedPool !== null}>
        {selectedPool && selectedEditor ? (
          <DialogContent>
            <div className="grid gap-2 pr-10">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {t((messages) => messages.adminSandboxRuntime.editPoolTitle)} {selectedOwnerLabel}
              </DialogTitle>
              <DialogDescription className="m-0 text-sm leading-6 text-muted-foreground">
                {t((messages) => messages.adminSandboxRuntime.editPoolDescription)}
              </DialogDescription>
            </div>

            {errorMessage ? <ErrorNotice>{errorMessage}</ErrorNotice> : null}

            <div className="grid gap-4 rounded-[1.2rem] border border-[color:var(--border-soft)]/70 bg-[color:var(--surface-muted)]/55 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedPool.enabled ? 'success' : 'neutral'}>
                  {selectedPool.enabled
                    ? t((messages) => messages.adminSandboxRuntime.enabled)
                    : t((messages) => messages.adminSandboxRuntime.disabled)}
                </Badge>
                <Badge variant={selectedPool.runtime?.state === 'running' ? 'success' : 'neutral'}>
                  {selectedPool.runtime?.state ?? t((messages) => messages.adminSandboxRuntime.runtimeUnavailable)}
                </Badge>
                {selectedPool.apiKeyConfigured ? (
                  <Badge variant="outline">
                    <KeyRound className="mr-1 h-3 w-3" />
                    {t((messages) => messages.adminSandboxRuntime.apiKeyConfigured)}
                  </Badge>
                ) : null}
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <PoolMetric label={t((messages) => messages.adminSandboxRuntime.endpoint)} value={selectedPool.runtime?.url ?? unavailableLabel} />
                <PoolMetric label={t((messages) => messages.adminSandboxRuntime.pid)} value={formatNullableNumber(selectedPool.runtime?.pid ?? null, unavailableLabel)} />
                <PoolMetric label={t((messages) => messages.adminSandboxRuntime.cpu)} value={formatPercent(selectedPool.runtime?.cpuPercent ?? null, unavailableLabel)} />
                <PoolMetric label={t((messages) => messages.adminSandboxRuntime.memory)} value={formatBytes(selectedPool.runtime?.rssBytes ?? null, unavailableLabel)} />
                <PoolMetric
                  label={t((messages) => messages.adminSandboxRuntime.lastRestart)}
                  value={
                    <LocalizedDateTime
                      locale={locale}
                      unavailableLabel={unavailableLabel}
                      value={selectedPool.restartRequestedAt}
                    />
                  }
                />
              </dl>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PoolConfigInput
                errorMessage={selectedFieldErrors.poolSize}
                label={t((messages) => messages.adminSandboxRuntime.poolSize)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.poolSize}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { poolSize: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.minReadyProcesses}
                label={t((messages) => messages.adminSandboxRuntime.minReadyProcesses)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.minReadyProcesses}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { minReadyProcesses: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.maxConcurrentInit}
                label={t((messages) => messages.adminSandboxRuntime.maxConcurrentInit)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.maxConcurrentInit}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { maxConcurrentInit: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.healthCheckIntervalMs}
                label={t((messages) => messages.adminSandboxRuntime.healthCheckIntervalMs)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.healthCheckIntervalMs}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { healthCheckIntervalMs: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.sessionTimeoutMs}
                label={t((messages) => messages.adminSandboxRuntime.sessionTimeoutMs)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.sessionTimeoutMs}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { sessionTimeoutMs: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.port}
                label={t((messages) => messages.adminSandboxRuntime.port)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.port}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { port: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.portRangeStart}
                label={t((messages) => messages.adminSandboxRuntime.portRangeStart)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.portRangeStart}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { portRangeStart: value })}
              />
              <PoolConfigInput
                errorMessage={selectedFieldErrors.portRangeEnd}
                label={t((messages) => messages.adminSandboxRuntime.portRangeEnd)}
                ownerLabel={selectedOwnerLabel}
                value={selectedEditor.portRangeEnd}
                onChange={(value) => updateEditor(selectedPool.ownerUserId, { portRangeEnd: value })}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={() => handleToggle(selectedPool)}
                type="button"
                variant="outline"
              >
                <Power className="h-4 w-4" />
                {isPending && pendingAction?.ownerUserId === selectedPool.ownerUserId && pendingAction.type === 'toggle'
                  ? t((messages) => messages.adminSandboxRuntime.savePending)
                  : editors[selectedPool.ownerUserId].enabled
                    ? t((messages) => messages.adminSandboxRuntime.disablePool)
                    : t((messages) => messages.adminSandboxRuntime.enablePool)}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => handleRestart(selectedPool.ownerUserId)}
                type="button"
                variant="outline"
              >
                <RotateCw className="h-4 w-4" />
                {isPending && pendingAction?.ownerUserId === selectedPool.ownerUserId && pendingAction.type === 'restart'
                  ? t((messages) => messages.adminSandboxRuntime.restartPending)
                  : t((messages) => messages.adminSandboxRuntime.restartPool)}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => handleSave(selectedPool)}
                type="button"
              >
                <Save className="h-4 w-4" />
                {isPending && pendingAction?.ownerUserId === selectedPool.ownerUserId && pendingAction.type === 'save'
                  ? t((messages) => messages.adminSandboxRuntime.savePending)
                  : t((messages) => messages.adminSandboxRuntime.saveConfig)}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

interface ResourceMetricProps {
  icon?: ReactNode;
  label: string;
  value: string;
}

function ResourceMetric({ icon, label, value }: ResourceMetricProps) {
  return (
    <div className="grid gap-2 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
        {icon}
        {label}
      </dt>
      <dd className="m-0 text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}

interface PoolMetricProps {
  label: string;
  value: ReactNode;
}

function PoolMetric({ label, value }: PoolMetricProps) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">{label}</dt>
      <dd className="m-0 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

interface PoolConfigInputProps {
  errorMessage?: string;
  label: string;
  onChange: (value: string) => void;
  ownerLabel: string;
  value: string;
}

function PoolConfigInput({
  errorMessage,
  label,
  onChange,
  ownerLabel,
  value,
}: PoolConfigInputProps) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</span>
      <Input
        aria-invalid={errorMessage ? 'true' : 'false'}
        aria-label={`${label} for ${ownerLabel}`}
        min={1}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
      {errorMessage ? (
        <span className="text-sm text-[color:var(--status-danger)]">{errorMessage}</span>
      ) : null}
    </label>
  );
}

function createEditorStateByOwner(pools: readonly AdminSandboxRuntimePoolItem[]): Record<string, PoolEditorState> {
  return Object.fromEntries(pools.map((pool) => [pool.ownerUserId, toEditorState(pool)]));
}

function toEditorState(pool: AdminSandboxRuntimePoolItem): PoolEditorState {
  return {
    enabled: pool.enabled,
    healthCheckIntervalMs: String(pool.healthCheckIntervalMs),
    maxConcurrentInit: String(pool.maxConcurrentInit),
    minReadyProcesses: String(pool.minReadyProcesses),
    poolSize: String(pool.poolSize),
    port: String(pool.port),
    portRangeEnd: String(pool.portRangeEnd),
    portRangeStart: String(pool.portRangeStart),
    sessionTimeoutMs: String(pool.sessionTimeoutMs),
  };
}

function parseEditorState(
  editor: PoolEditorState,
  validationMessages: ValidationMessages,
):
  | { data: ReturnType<typeof toPatchPayload>; success: true }
  | { fieldErrors: FieldErrors; success: false } {
  const parsedValues = Object.fromEntries(
    EDITABLE_FIELD_NAMES.map((fieldName) => [fieldName, parsePositiveInteger(editor[fieldName])]),
  ) as Record<FieldName, number | null>;
  const fieldErrors: FieldErrors = {};

  EDITABLE_FIELD_NAMES.forEach((fieldName) => {
    if (parsedValues[fieldName] === null) {
      fieldErrors[fieldName] = validationMessages.positiveInteger;
    }
  });

  if (
    parsedValues.minReadyProcesses !== null
    && parsedValues.poolSize !== null
    && parsedValues.minReadyProcesses > parsedValues.poolSize
  ) {
    fieldErrors.minReadyProcesses = validationMessages.minReadyProcessesExceedsPoolSize;
  }

  if (
    parsedValues.portRangeStart !== null
    && parsedValues.portRangeEnd !== null
    && parsedValues.portRangeStart > parsedValues.portRangeEnd
  ) {
    fieldErrors.portRangeStart = validationMessages.portRangeStartExceedsEnd;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      success: false,
    };
  }

  return {
    data: toPatchPayload(editor, parsedValues),
    success: true,
  };
}

function toPatchPayload(editor: PoolEditorState, parsedValues: Record<FieldName, number | null>) {
  return {
    enabled: editor.enabled,
    healthCheckIntervalMs: parsedValues.healthCheckIntervalMs!,
    maxConcurrentInit: parsedValues.maxConcurrentInit!,
    minReadyProcesses: parsedValues.minReadyProcesses!,
    poolSize: parsedValues.poolSize!,
    port: parsedValues.port!,
    portRangeEnd: parsedValues.portRangeEnd!,
    portRangeStart: parsedValues.portRangeStart!,
    sessionTimeoutMs: parsedValues.sessionTimeoutMs!,
  };
}

function clearPatchedFieldErrors(patch: Partial<PoolEditorState>): FieldErrors {
  const nextErrors: FieldErrors = {};

  Object.keys(patch).forEach((fieldName) => {
    if (fieldName === 'enabled') {
      return;
    }

    nextErrors[fieldName as FieldName] = undefined;
  });

  if ('poolSize' in patch || 'minReadyProcesses' in patch) {
    nextErrors.poolSize = undefined;
    nextErrors.minReadyProcesses = undefined;
  }

  if ('portRangeStart' in patch || 'portRangeEnd' in patch) {
    nextErrors.portRangeStart = undefined;
    nextErrors.portRangeEnd = undefined;
  }

  return nextErrors;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatPercent(value: number | null, unavailableLabel: string) {
  return value === null ? unavailableLabel : `${value.toFixed(1)}%`;
}

function formatBytes(value: number | null, unavailableLabel: string) {
  if (value === null) {
    return unavailableLabel;
  }

  const mb = value / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatNullableNumber(value: number | null, unavailableLabel: string) {
  return value === null ? unavailableLabel : String(value);
}
