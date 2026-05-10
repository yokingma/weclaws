import { requestBotQrReissue } from '@/lib/bot-service';
import { fail, ok } from '@/lib/api-error';
import { requireOwnedBot, requireRequestSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;

    await requireOwnedBot(id, session.user.id);

    return ok(await requestBotQrReissue(id));
  } catch (error) {
    return fail(error);
  }
}
