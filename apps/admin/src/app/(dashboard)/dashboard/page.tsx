import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getApps } from '@/lib/api';
import type { AppSummary } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { CreateAppButton } from './CreateAppButton';

export const dynamic = 'force-dynamic';

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76c.28.16.6.22.91.17l11.65-11.65L12.1 8.64 3.18 23.76zM20.55 10.2L17.3 8.36l-3.47 3.47 3.47 3.47 3.27-1.84c.93-.53.93-1.73-.02-2.26zM2.01 1.35C1.99 1.52 2 1.7 2.07 1.88L13.72 13.5 16.9 10.3 3.1.87C2.7.63 2.24.79 2.01 1.35zM2.07 22.12c-.06.18-.07.36-.06.53.23.56.69.72 1.09.48l13.8-9.43-3.17-3.17L2.07 22.12z" />
    </svg>
  );
}

function AppStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function AppIcon({ app }: { app: AppSummary }) {
  if (app.storeIconUrl) {
    return (
      <Image
        src={app.storeIconUrl}
        alt={`${app.name} icon`}
        width={48}
        height={48}
        className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
        unoptimized
      />
    );
  }
  const letter = app.name.charAt(0).toUpperCase();
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-xl font-bold text-white">
      {letter}
    </div>
  );
}

function RatingPill({
  platform,
  rating,
  reviewCount,
}: {
  platform: 'play' | 'appstore';
  rating: number;
  reviewCount?: number | null;
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      {platform === 'play' ? (
        <PlayStoreIcon className="h-3 w-3 text-green-600" />
      ) : (
        <AppStoreIcon className="h-3 w-3 text-blue-500" />
      )}
      <StarIcon className="h-3 w-3 text-amber-400" />
      <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
      {reviewCount != null && (
        <span className="text-gray-400">({reviewCount.toLocaleString()})</span>
      )}
    </span>
  );
}

function AppCard({ app }: { app: AppSummary }) {
  const hasPlay = app.playRating != null;
  const hasAppStore = app.appStoreRating != null;
  const hasRatings = hasPlay || hasAppStore;

  return (
    <Link
      href={`/apps/${app.id}`}
      className="flex flex-col rounded-2xl border border-[var(--color-border,#e5e7eb)] bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      {/* Top row: icon + name + publisher */}
      <div className="flex items-start gap-3">
        <AppIcon app={app} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{app.name}</div>
          {app.publisherName && (
            <div className="truncate text-sm text-gray-500">{app.publisherName}</div>
          )}
        </div>
      </div>

      {/* Ratings row */}
      {hasRatings && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {hasPlay && (
            <RatingPill
              platform="play"
              rating={app.playRating!}
              reviewCount={app.playReviewCount}
            />
          )}
          {hasAppStore && (
            <RatingPill
              platform="appstore"
              rating={app.appStoreRating!}
              reviewCount={app.appStoreReviewCount}
            />
          )}
        </div>
      )}

      {/* Bottom row: store links + event count */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {app.playStoreUrl && (
            <span
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              <PlayStoreIcon className="h-3 w-3 text-green-600" />
              Play
            </span>
          )}
          {app.appStoreUrl && (
            <span
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              <AppStoreIcon className="h-3 w-3 text-blue-500" />
              App Store
            </span>
          )}
        </div>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {app.eventCount.toLocaleString()} events
        </span>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let apps: AppSummary[] = [];
  try {
    apps = await getApps(token);
  } catch {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your apps</h1>
          <p className="text-sm text-gray-500">
            {apps.length === 0 ? 'No apps yet' : `${apps.length} app${apps.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <CreateAppButton />
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Create your first app</h2>
          <p className="mb-6 max-w-xs text-sm text-gray-500">
            Each app gets its own API key. Add store URLs to pull in ratings, icon, and publisher info automatically.
          </p>
          <CreateAppButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
