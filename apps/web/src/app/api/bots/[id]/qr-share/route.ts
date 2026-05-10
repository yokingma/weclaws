import { disableBotQrShare, enableBotQrShare, getBotQrShareForOwner } from '@/lib/bot-qr-share-service';
import { fail, ok } from '@/lib/api-error';
import { requireOwnedBot, requireRequestSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;

    await requireOwnedBot(id, session.user.id);

    return ok(await getBotQrShareForOwner(id));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;

    await requireOwnedBot(id, session.user.id);

    return ok(await enableBotQrShare(id));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    const { id } = await context.params;

    await requireOwnedBot(id, session.user.id);

    return ok(await disableBotQrShare(id));
  } catch (error) {
    return fail(error);
  }
}
