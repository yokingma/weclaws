'use client';

import { PreviewEmptyState } from '@/components/layout/preview-empty-state';
import { WorkspacePanel } from '@/components/layout/workspace-panel';
import { useLocale } from '@/components/providers/locale-provider';

export function BotWorkspacePreviews() {
  const { t } = useLocale();
  const badge = t((messages) => messages.botDetail.previewComingSoon);
  const sessionsTitle = t((messages) => messages.botDetail.sessionsPreviewTitle);
  const filesTitle = t((messages) => messages.botDetail.workspaceFilesPreviewTitle);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WorkspacePanel title={sessionsTitle}>
        <div aria-label={sessionsTitle} role="region">
          <PreviewEmptyState
            badge={badge}
            description={t((messages) => messages.botDetail.sessionsPreviewDescription)}
          />
        </div>
      </WorkspacePanel>
      <WorkspacePanel title={filesTitle}>
        <div aria-label={filesTitle} role="region">
          <PreviewEmptyState
            badge={badge}
            description={t((messages) => messages.botDetail.workspaceFilesPreviewDescription)}
          />
        </div>
      </WorkspacePanel>
    </div>
  );
}
