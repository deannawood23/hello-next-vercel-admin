'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const NAV_ITEMS = [
    { href: '/vote', label: 'Vote' },
    { href: '/new', label: 'New Post' },
];

export function AppShell() {
    const pathname = usePathname();
    useEffect(() => {
        console.log('navbar mounted');
    }, []);

    return (
        <header className="fixed left-0 right-0 top-0 z-[100] border-b border-white/15 bg-[#050506] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
            <span
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: '<!-- NAVBAR_MOUNTED -->' }}
            />
            <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
                <nav className="flex items-center gap-2 sm:gap-3">
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`) ||
                            (item.href === '/new' &&
                                (pathname === '/new-post' ||
                                    pathname.startsWith('/new-post/')));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                    isActive
                                        ? 'bg-[#5E6AD2] text-white'
                                        : 'text-[#EDEDEF] hover:bg-white/[0.08]'
                                } ${isActive ? 'active' : ''}`}
                                data-active={isActive ? 'true' : 'false'}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <Link
                    href="/login"
                    className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-[#EDEDEF] transition hover:bg-white/[0.1]"
                >
                    Login
                </Link>
            </div>
        </header>
    );
}
