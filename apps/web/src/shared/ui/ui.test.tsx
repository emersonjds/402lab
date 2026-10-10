import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, buttonStyles } from './button';
import { Card } from './card';
import { DevnetBadge } from './devnet-badge';
import { Money } from './money';
import { Pill } from './pill';
import { SolscanLink } from './solscan-link';

describe('Money', () => {
  it.each([
    ['5000', '$0.005'],
    ['17000', '$0.017'],
    [1_000_000n, '$1'],
    [4_983_000n, '$4.983'],
  ] as const)('formats %s atomic USDC as %s', (amount, text) => {
    render(<Money amount={amount} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('uses tabular monospace figures', () => {
    render(<Money amount="2000" className="text-lime" />);

    expect(screen.getByText('$0.002')).toHaveClass('font-mono', 'tabular-nums', 'text-lime');
  });
});

describe('Pill', () => {
  it.each([
    ['active', 'ACTIVE'],
    ['paused', 'PAUSED'],
    ['settled', 'SETTLED'],
    ['pending', 'PENDING'],
    ['failed', 'FAILED'],
  ] as const)('shows %s as text with a decorative icon', (status, label) => {
    const { container } = render(<Pill status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SolscanLink', () => {
  it('opens the devnet transaction on Solscan in a new tab', () => {
    render(<SolscanLink signature="5Jtsig" />);

    const link = screen.getByRole('link', { name: 'View on Solscan (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://solscan.io/tx/5Jtsig?cluster=devnet');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('DevnetBadge', () => {
  it('labels the network', () => {
    render(<DevnetBadge />);

    expect(screen.getByText('DEVNET')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('is a non-submitting button by default with a 44px target', () => {
    render(<Button>Pause</Button>);

    const button = screen.getByRole('button', { name: 'Pause' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('min-h-11');
  });

  it('keeps the submit type and the secondary style when asked', () => {
    render(
      <Button type="submit" variant="secondary" disabled>
        Send
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    expect(button.className).toBe(buttonStyles('secondary'));
  });

  it('styles links as buttons', () => {
    expect(buttonStyles()).toContain('bg-lime');
    expect(buttonStyles('ghost')).not.toContain('bg-lime');
  });
});

describe('Card', () => {
  it('renders its content on a surface', () => {
    render(<Card className="p-4">Balance</Card>);

    expect(screen.getByText('Balance')).toHaveClass('rounded-card', 'bg-surface', 'p-4');
  });
});
