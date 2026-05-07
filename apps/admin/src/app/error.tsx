'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[RootError] caught server error:', error.message, error.stack);
  }, [error]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '16px', border: '1px solid #fecaca', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ color: '#ef4444', fontSize: '36px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '13px', color: '#dc2626', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '8px', padding: '8px', background: '#fef2f2', borderRadius: '8px' }}>
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
            Digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{ background: '#0e9e80', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
