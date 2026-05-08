import { redirect } from 'next/navigation';
import { getSubscription } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { BillingClient } from './BillingClient';

export const dynamic = 'force-dynamic';

export default async function BillingPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  const subscription = await getSubscription(token, params.id).catch(() => null);

  return <BillingClient appId={params.id} initialSubscription={subscription} />;
}
