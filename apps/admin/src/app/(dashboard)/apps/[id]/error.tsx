'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppDetailError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[AppDetail] caught server error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Something went wrong</h2>
      <p className="mb-1 max-w-sm text-sm text-gray-500">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      {error.digest && (
        <p className="mb-4 font-mono text-xs text-gray-400">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
