import { getPublicBotQrShare } from '@/lib/bot-qr-share-service';
import { fail, ok } from '@/lib/api-error';

interface RouteContext {
  params: Promise<{ token: string }> | { token: string };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { token } = await context.params;
    const response = ok(await getPublicBotQrShare(token));
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return fail(error);
  }
}
