'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type AdminShellProps = {
    children: React.ReactNode;
    userEmail?: string | null;
};

type NavItem = {
    href: string;
    label: string;
    icon: React.ReactNode;
};

const navItems: NavItem[] = [
    {
        href: '/admin',
        label: 'Overview',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="5" rx="1.5" />
                <rect x="13" y="10" width="8" height="11" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
            </svg>
        ),
    },
    {
        href: '/admin/users',
        label: 'Users',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <circle cx="9" cy="8" r="3" />
                <circle cx="17" cy="9" r="2.5" />
                <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
                <path d="M14.5 19a4 4 0 0 1 6 0" />
            </svg>
        ),
    },
    {
        href: '/admin/images',
        label: 'Images',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="1.8" />
                <path d="m21 16-4.5-4.5L8 20" />
            </svg>
        ),
    },
    {
        href: '/admin/captions',
        label: 'Captions',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path d="M4 6h16" />
                <path d="M4 12h12" />
                <path d="M4 18h9" />
            </svg>
        ),
    },
    {
        href: '/admin#settings',
        label: 'Settings',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.5 1.5 0 0 0 .3 1.65l.06.06a1.8 1.8 0 0 1 0 2.54 1.8 1.8 0 0 1-2.54 0l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37V21a1.8 1.8 0 0 1-3.6 0v-.09a1.5 1.5 0 0 0-.98-1.4 1.5 1.5 0 0 0-1.65.3l-.06.06a1.8 1.8 0 0 1-2.54 0 1.8 1.8 0 0 1 0-2.54l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H3a1.8 1.8 0 0 1 0-3.6h.09a1.5 1.5 0 0 0 1.4-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06a1.8 1.8 0 0 1 0-2.54 1.8 1.8 0 0 1 2.54 0l.06.06a1.5 1.5 0 0 0 1.65.3h.08a1.5 1.5 0 0 0 .9-1.37V3a1.8 1.8 0 0 1 3.6 0v.09a1.5 1.5 0 0 0 .98 1.4 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 0 1 2.54 0 1.8 1.8 0 0 1 0 2.54l-.06.06a1.5 1.5 0 0 0-.3 1.65v.08a1.5 1.5 0 0 0 1.37.9H21a1.8 1.8 0 0 1 0 3.6h-.09a1.5 1.5 0 0 0-1.4.98z" />
            </svg>
        ),
    },
];

function isActive(pathname: string, href: string) {
    if (href === '/admin') {
        return pathname === '/admin';
    }

    if (href.startsWith('/admin#')) {
        return false;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, userEmail }: AdminShellProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="linear-page-bg min-h-screen text-[#EDEDEF]">
            <div aria-hidden="true" className="linear-grid absolute inset-0 opacity-100" />
            <div aria-hidden="true" className="linear-noise absolute inset-0 opacity-[0.015]" />
            <div aria-hidden="true" className="ambient-blob ambient-blob-primary" />
            <div aria-hidden="true" className="ambient-blob ambient-blob-secondary" />
            <div className="relative z-10 flex min-h-screen">
                <aside
                    className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-[#09090d]/95 p-4 backdrop-blur transition-transform duration-200 lg:static lg:translate-x-0 ${
                        isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="mb-6 px-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#8A8F98]">Admin</p>
                        <p className="mt-1 truncate text-sm text-[#B6BCC6]">{userEmail ?? 'Superadmin'}</p>
                    </div>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const active = isActive(pathname, item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                        active
                                            ? 'border-[#5E6AD2]/60 bg-[#5E6AD2]/25 text-white'
                                            : 'border-transparent text-[#C2C8D2] hover:border-white/10 hover:bg-white/[0.06]'
                                    }`}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {isOpen ? (
                    <button
                        type="button"
                        aria-label="Close sidebar"
                        className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                ) : null}

                <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
                    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-[#07070b]/85 px-4 backdrop-blur">
                        <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#EDEDEF] lg:hidden"
                            aria-label="Open sidebar"
                            onClick={() => setIsOpen(true)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M3 12h18" />
                                <path d="M3 18h18" />
                            </svg>
                        </button>
                        <h1 className="font-[var(--font-playfair)] text-xl font-semibold tracking-tight text-[#EDEDEF]">Dashboard</h1>
                    </header>
                    <main className="flex-1 p-4 sm:p-6">{children}</main>
                </div>
            </div>
        </div>
    );
}
