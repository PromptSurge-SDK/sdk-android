'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import type { AppSubscription } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function buildGroups(appId: string): NavGroup[] {
  return [
    {
      label: 'Setup',
      items: [
        {
          label: 'SDK Installation',
          href: `/apps/${appId}/install`,
          icon: <Icon d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        },
      ],
    },
    {
      label: 'Analytics',
      items: [
        {
          label: 'Overview',
          href: `/apps/${appId}`,
          icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
        },
        {
          label: 'Metrics',
          href: `/apps/${appId}/metrics`,
          icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
        },
        {
          label: 'Events',
          href: `/apps/${appId}/events`,
          icon: <Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
        },
      ],
    },
    {
      label: 'Prompts',
      items: [
        {
          label: 'Prompt texts',
          href: `/apps/${appId}/prompts`,
          icon: <Icon d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />,
        },
        {
          label: 'Keywords',
          href: `/apps/${appId}/keywords`,
          icon: <Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
        },
        {
          label: 'Review themes',
          href: `/apps/${appId}/themes`,
          icon: <Icon d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
        },
        {
          label: 'Appearance',
          href: `/apps/${appId}/appearance`,
          icon: <Icon d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />,
        },
      ],
    },
    {
      label: 'Settings',
      items: [
        {
          label: 'LLM provider',
          href: `/apps/${appId}/llm-config`,
          icon: <Icon d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />,
        },
        {
          label: 'LLM usage',
          href: `/apps/${appId}/llm-usage`,
          icon: <Icon d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
        },
        {
          label: 'Billing',
          href: `/apps/${appId}/settings/billing`,
          icon: <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
        },
        {
          label: 'Team',
          href: `/apps/${appId}/settings/team`,
          icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
        },
      ],
    },
  ];
}

interface Props {
  appId: string;
  appName: string;
  apps: { id: string; name: string }[];
  subscription: AppSubscription | null;
}

export function AppSidebar({ appId, appName, apps, subscription }: Props) {
  const pathname = usePathname();
  const groups = buildGroups(appId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function isActive(href: string) {
    if (href === `/apps/${appId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  const isUnlimited = subscription?.limit === null;
  const usagePct = subscription && !isUnlimited
    ? Math.min(100, Math.round((subscription.impressions / subscription.limit!) * 100))
    : 0;
  const isNearLimit = !isUnlimited && usagePct >= 80;
  const isOverLimit = !isUnlimited && subscription && subscription.impressions >= subscription.limit!;
  const hasSubWarning = subscription && (
    subscription.status === 'past_due' ||
    subscription.status === 'cancelled' ||
    isOverLimit
  );

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* App switcher */}
      <div className="border-b border-gray-100 px-3 py-3" ref={dropdownRef}>
        <Link
          href="/dashboard"
          className="mb-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All apps
        </Link>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="truncate text-left">{appName}</span>
            <svg
              className={`ml-1 h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && apps.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {apps.map(a => (
                <Link
                  key={a.id}
                  href={`/apps/${a.id}`}
                  onClick={() => setDropdownOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    a.id === appId
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {a.id === appId && (
                    <svg className="h-3 w-3 flex-shrink-0 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={`truncate ${a.id !== appId ? 'ml-5' : ''}`}>{a.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={active ? 'text-brand-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Subscription footer */}
      {subscription && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1 text-xs ${hasSubWarning ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {hasSubWarning && (
                <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {subscription.status === 'past_due' ? 'Payment failed' :
               subscription.status === 'cancelled' ? 'Cancelled' :
               subscription.tierLabel}
            </span>
            {subscription.tier === 'indie' && (
              <Link
                href={`/apps/${appId}/settings/billing`}
                className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
              >
                Upgrade →
              </Link>
            )}
            {(subscription.status === 'past_due' || subscription.status === 'cancelled') && (
              <Link
                href={`/apps/${appId}/settings/billing`}
                className="text-[11px] font-medium text-red-600 hover:text-red-700"
              >
                Fix →
              </Link>
            )}
          </div>
          {!isUnlimited && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-brand-500'
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400">
                {subscription.impressions.toLocaleString()} / {subscription.limit!.toLocaleString()} prompt impressions
              </p>
            </div>
          )}
          {isUnlimited && (
            <p className="text-[10px] text-gray-400">Unlimited prompt impressions</p>
          )}
        </div>
      )}
    </aside>
  );
}
