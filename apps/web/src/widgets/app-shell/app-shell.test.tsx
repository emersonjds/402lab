import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

const pathname = vi.hoisted(() => ({ current: '/app' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

describe('AppShell', () => {
  it('wraps the page with the devnet badge and a wallet placeholder', () => {
    render(<AppShell>Allowances go here</AppShell>);

    expect(screen.getByRole('main')).toHaveTextContent('Allowances go here');
    expect(within(screen.getByRole('banner')).getByText('DEVNET')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument();
  });

  it('offers the same destinations in the sidebar and the mobile tab bar', () => {
    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'App' });
    const tabs = screen.getByRole('navigation', { name: 'App tabs' });
    for (const nav of [sidebar, tabs]) {
      expect(within(nav).getByRole('link', { name: 'Allowances' })).toHaveAttribute('href', '/app');
      expect(within(nav).getByRole('link', { name: 'Playground' })).toHaveAttribute(
        'href',
        '/playground',
      );
    }
  });

  it('marks the current destination', () => {
    pathname.current = '/app/allowances/abc';
    render(<AppShell>content</AppShell>);

    const tabs = screen.getByRole('navigation', { name: 'App tabs' });
    expect(within(tabs).getByRole('link', { name: 'Allowances' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: 'Playground' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
