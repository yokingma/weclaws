import { PublicQrShareView } from '@/components/bots/public-qr-share-view';

interface ShareQrPageProps {
  params: Promise<{ token: string }> | { token: string };
}

export default async function ShareQrPage({ params }: ShareQrPageProps) {
  const { token } = await params;

  return <PublicQrShareView token={token} />;
}
