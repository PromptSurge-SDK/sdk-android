'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
}

export function AppSidebar({ appId, appName }: Props) {
  const pathname = usePathname();
  const groups = buildGroups(appId);

  function isActive(href: string) {
    if (href === `/apps/${appId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* App name header */}
      <div className="border-b border-gray-100 px-4 py-4">
        <Link
          href="/dashboard"
          className="mb-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All apps
        </Link>
        <p className="truncate text-sm font-semibold text-gray-900" title={appName}>
          {appName}
        </p>
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
    </aside>
  );
}
