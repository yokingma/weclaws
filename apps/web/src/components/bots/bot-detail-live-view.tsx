'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import { ErrorNotice } from '@/components/ui/error-notice';
import type { BotDetailItem, BotEventItem } from '@/lib/bot-service';
import type { LlmProfileItem } from '@/lib/llm-profiles';
import { BotDetailHeader } from './bot-detail-header';
import { BotEventsList } from './bot-events-list';
import { BotQrSharePanel } from './bot-qr-share-panel';
import { BotWorkspacePreviews } from './bot-workspace-previews';

interface BotDetailLiveViewProps {
  initialBot: BotDetailItem;
  initialEvents: BotEventItem[];
  profiles: LlmProfileItem[];
}

export function BotDetailLiveView({ initialBot, initialEvents, profiles }: BotDetailLiveViewProps) {
  const [bot, setBot] = useState(initialBot);
  const [events, setEvents] = useState(initialEvents);
  const [streamErrorMessage, setStreamErrorMessage] = useState<string | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    const eventSource = new EventSource(`/api/bots/${initialBot.id}/stream`);

    const applyBotPayload = (event: Event) => {
      const nextBot = JSON.parse((event as MessageEvent<string>).data) as Partial<BotDetailItem>;
      setStreamErrorMessage(null);
      setBot((previous) => ({
        ...previous,
        ...nextBot,
      }));
    };

    const appendEvent = (event: Event) => {
      const nextEvent = JSON.parse((event as MessageEvent<string>).data) as BotEventItem;
      setStreamErrorMessage(null);

      setEvents((previous) => {
        const remaining = previous.filter((item) => item.id !== nextEvent.id);
        return [nextEvent, ...remaining];
      });
    };

    const applyStreamError = (event: Event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { message?: string };
      setStreamErrorMessage(payload.message ?? 'Unexpected server error.');
    };

    eventSource.addEventListener('bot.status.updated', applyBotPayload);
    eventSource.addEventListener('bot.qrcode.updated', applyBotPayload);
    eventSource.addEventListener('bot.error.updated', applyBotPayload);
    eventSource.addEventListener('bot.stream.error', applyStreamError);
    eventSource.addEventListener('bot.event.created', appendEvent);

    return () => {
      eventSource.close();
    };
  }, [initialBot.id]);

  return (
    <div className="grid gap-5">
      <BotDetailHeader
        bot={bot}
        onBotUpdated={(nextBot) => {
          setBot(nextBot);
        }}
        profiles={profiles}
      />
      {streamErrorMessage ? <ErrorNotice>{streamErrorMessage}</ErrorNotice> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <aside aria-label={t((messages) => messages.botDetail.controlsRegion)} className="grid content-start gap-5">
          <BotQrSharePanel
            bot={bot}
            onBotUpdated={(nextBot) => {
              setBot(nextBot);
            }}
          />
        </aside>

        <section aria-label={t((messages) => messages.botDetail.activityRegion)} className="grid content-start gap-5">
          <BotEventsList events={events} />
        </section>
      </div>
      <BotWorkspacePreviews />
    </div>
  );
}
