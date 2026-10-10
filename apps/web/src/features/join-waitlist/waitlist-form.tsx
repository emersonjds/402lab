'use client';

import { useId, useState, type SubmitEvent } from 'react';
import { z } from 'zod';

import { apiRequest } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';

export const WAITLIST_COPY = {
  invalid: 'Enter a valid email address, like you@company.com.',
  failed: "We couldn't add you right now. Try again in a minute.",
  joined: "You're on the list.",
} as const;

const emailSchema = z.email().max(254);

type FormState = 'idle' | 'sending' | 'invalid' | 'failed' | 'joined';

export const WaitlistForm = () => {
  const [state, setState] = useState<FormState>('idle');
  const inputId = useId();
  const messageId = useId();

  if (state === 'joined') {
    return (
      <p role="status" className="font-display text-xl text-lime">
        {WAITLIST_COPY.joined}
      </p>
    );
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = emailSchema.safeParse(new FormData(event.currentTarget).get('email'));
    if (!email.success) {
      setState('invalid');
      return;
    }

    setState('sending');
    try {
      await apiRequest('/waitlist', {
        method: 'POST',
        body: { email: email.data },
        schema: z.null(),
      });
      setState('joined');
    } catch {
      setState('failed');
    }
  };

  const error = state === 'invalid' || state === 'failed' ? WAITLIST_COPY[state] : null;

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="grid gap-3">
      <label htmlFor={inputId} className="text-sm text-muted">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={state === 'invalid'}
          aria-describedby={error ? messageId : undefined}
          className="min-h-12 w-full rounded-card border border-line bg-bg px-4 font-mono text-base text-text placeholder:text-muted/70 focus:border-lime aria-invalid:border-red"
        />
        <Button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Joining…' : 'Join the waitlist'}
        </Button>
      </div>
      {error && (
        <p id={messageId} role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
};
