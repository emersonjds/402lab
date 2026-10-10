import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WAITLIST_COPY, WaitlistForm } from './waitlist-form';

const stubFetch = (response: Response | Error) => {
  const fetchMock = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const submit = async (email: string) => {
  const user = userEvent.setup();
  render(<WaitlistForm />);
  if (email !== '') await user.type(screen.getByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Join the waitlist' }));
};

describe('WaitlistForm', () => {
  it('joins the waitlist through the api proxy and confirms', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 201 }));

    await submit('ada@example.com');

    expect(await screen.findByRole('status')).toHaveTextContent("You're on the list.");
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/waitlist',
      expect.objectContaining({ method: 'POST', body: '{"email":"ada@example.com"}' }),
    );
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });

  it.each(['', 'not-an-email'])('rejects %j without calling the api', async (email) => {
    const fetchMock = stubFetch(new Response(null, { status: 201 }));

    await submit(email);

    expect(screen.getByRole('alert')).toHaveTextContent(WAITLIST_COPY.invalid);
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows fixed copy when the api fails, never the server text', async () => {
    stubFetch(
      new Response(JSON.stringify({ error: 'duplicate key value violates constraint' }), {
        status: 500,
      }),
    );

    await submit('ada@example.com');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(WAITLIST_COPY.failed);
    expect(alert).not.toHaveTextContent('duplicate');
    expect(screen.getByRole('button', { name: 'Join the waitlist' })).toBeEnabled();
  });

  it('shows the same fixed copy when the network is down', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await submit('ada@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(WAITLIST_COPY.failed);
  });

  it('keeps the input at 16px or larger for mobile', () => {
    render(<WaitlistForm />);

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveClass('text-base');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
  });
});
