import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './landing-page';

const renderLanding = (demoUrl?: string) =>
  render(demoUrl ? <LandingPage demoUrl={demoUrl} /> : <LandingPage />);

describe('LandingPage', () => {
  it('leads with the promise and both calls to action', () => {
    renderLanding('https://youtu.be/demo');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Pocket money for AI agents.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute(
      'href',
      '#waitlist',
    );
    expect(screen.getByRole('link', { name: 'Watch the 60s demo' })).toHaveAttribute(
      'href',
      'https://youtu.be/demo',
    );
  });

  it('hides the demo link until there is a video', () => {
    renderLanding();

    expect(screen.queryByRole('link', { name: 'Watch the 60s demo' })).not.toBeInTheDocument();
  });

  it('replays an agent run in the terminal', () => {
    renderLanding();

    const terminal = screen.getByRole('figure', { name: 'Example agent run' });
    expect(terminal).toHaveTextContent('GET /svc/ocr → 402 Payment Required ($0.005)');
    expect(terminal).toHaveTextContent('total $0.017 · card + IOF would cost $0.95');
  });

  it('shows the three problem numbers', () => {
    renderLanding();

    const stats = screen.getByRole('region', { name: 'Why cards fail tiny payments' });
    expect(within(stats).getByText('3,003%')).toBeInTheDocument();
    expect(within(stats).getByText('card fee on a $0.01 API call')).toBeInTheDocument();
    expect(within(stats).getByText('3.5% IOF')).toBeInTheDocument();
    expect(within(stats).getByText('$5 minimum')).toBeInTheDocument();
    expect(within(stats).getByText('prepaid credits that expire in a year')).toBeInTheDocument();
  });

  it('explains how it works in three steps', () => {
    renderLanding();

    const steps = within(screen.getByRole('region', { name: 'How it works' })).getAllByRole(
      'listitem',
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Set an allowance — per-call and daily caps.');
    expect(steps[2]).toHaveTextContent(
      'Providers get paid automatically — revenue split on-chain every 30 seconds.',
    );
  });

  it('computes the example savings against card + IOF', () => {
    renderLanding();

    const proof = screen.getByRole('region', { name: 'Live proof' });
    expect(within(proof).getByText('Example data')).toBeInTheDocument();
    // OCR $0.005 + Translate $0.002 + Summarize $0.010 = $0.017 spent; card + IOF
    // ($0.315825 + $0.31263 + $0.32115 = $0.949605) minus what was spent.
    expect(within(proof).getByText('$0.932605')).toBeInTheDocument();
    expect(within(proof).getByText('$0.315825')).toBeInTheDocument();
    expect(within(proof).getAllByRole('row')).toHaveLength(4);
  });

  it('shows providers the price snippet', () => {
    renderLanding();

    const providers = screen.getByRole('region', {
      name: 'Answer 402 with a price. Get paid per call.',
    });
    expect(within(providers).getByText(/price: '\$0\.002'/)).toBeInTheDocument();
  });

  it('ends with the waitlist form and the footer', () => {
    renderLanding();

    const waitlist = screen.getByRole('region', { name: 'Join the waitlist' });
    expect(within(waitlist).getByLabelText('Email address')).toBeInTheDocument();
    expect(within(waitlist).getByText('Devnet demo. Mainnet after licensing.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('contentinfo')).getByText(
        "Built for Colosseum Crypto World's Fair · Solana",
      ),
    ).toBeInTheDocument();
  });
});
