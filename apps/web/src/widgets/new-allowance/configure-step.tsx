'use client';

import { usdToAtomic } from '@402lab/shared';
import { address } from '@solana/kit';
import { useState, type SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiRequest } from '@/shared/api/client';
import { allowanceSchema, type Allowance } from '@/shared/api/schemas';

interface ConfigureStepProps {
  initialSessionAddress: string;
  onCreated: (allowance: Allowance) => void;
}

type FieldErrors = Partial<Record<'agentName' | 'sessionAddress' | 'perCallCap' | 'dailyCap', string>>;

const validate = (
  agentName: string,
  sessionAddress: string,
  perCallCap: string,
  dailyCap: string,
): FieldErrors => {
  const errors: FieldErrors = {};

  if (agentName.trim().length === 0) errors.agentName = 'Name your agent.';

  try {
    address(sessionAddress.trim());
  } catch {
    errors.sessionAddress = 'Not a valid Solana address.';
  }

  let perCallAtomic = 0n;
  try {
    perCallAtomic = usdToAtomic(perCallCap);
    if (perCallAtomic <= 0n) errors.perCallCap = 'Must be greater than $0.';
  } catch {
    errors.perCallCap = 'Not a valid USD amount.';
  }

  let dailyAtomic = 0n;
  try {
    dailyAtomic = usdToAtomic(dailyCap);
    if (dailyAtomic <= 0n) errors.dailyCap = 'Must be greater than $0.';
  } catch {
    errors.dailyCap = 'Not a valid USD amount.';
  }

  if (!errors.perCallCap && !errors.dailyCap && perCallAtomic > dailyAtomic) {
    errors.perCallCap = "Per-call cap can't exceed the daily cap.";
  }

  return errors;
};

export const ConfigureStep = ({ initialSessionAddress, onCreated }: ConfigureStepProps) => {
  const [agentName, setAgentName] = useState('');
  const [sessionAddress, setSessionAddress] = useState(initialSessionAddress);
  const [perCallCap, setPerCallCap] = useState('0.05');
  const [dailyCap, setDailyCap] = useState('2.00');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(agentName, sessionAddress, perCallCap, dailyCap);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiRequest('/allowances', {
        method: 'POST',
        body: {
          agentName: agentName.trim(),
          sessionAddress: sessionAddress.trim(),
          perCallCap: usdToAtomic(perCallCap).toString(),
          dailyCap: usdToAtomic(dailyCap).toString(),
        },
        schema: allowanceSchema,
      });
      onCreated(created);
    } catch (caught) {
      setSubmitError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
      <div>
        <Label htmlFor="agentName">Agent name</Label>
        <Input
          id="agentName"
          value={agentName}
          onChange={(event) => { setAgentName(event.target.value); }}
          placeholder="research-bot"
          autoComplete="off"
          error={Boolean(fieldErrors.agentName)}
          hint={fieldErrors.agentName}
        />
      </div>

      <div>
        <Label htmlFor="sessionAddress">Agent session wallet</Label>
        <Input
          id="sessionAddress"
          value={sessionAddress}
          onChange={(event) => { setSessionAddress(event.target.value); }}
          placeholder="Solana address"
          autoComplete="off"
          className="font-mono"
          error={Boolean(fieldErrors.sessionAddress)}
          hint={fieldErrors.sessionAddress ?? 'The wallet the agent signs payments with.'}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="perCallCap">Per-call cap (USD)</Label>
          <Input
            id="perCallCap"
            inputMode="decimal"
            value={perCallCap}
            onChange={(event) => { setPerCallCap(event.target.value); }}
            error={Boolean(fieldErrors.perCallCap)}
            hint={fieldErrors.perCallCap ?? 'Max spend allowed per API call.'}
          />
        </div>
        <div>
          <Label htmlFor="dailyCap">Daily spending ceiling (USD)</Label>
          <Input
            id="dailyCap"
            inputMode="decimal"
            value={dailyCap}
            onChange={(event) => { setDailyCap(event.target.value); }}
            error={Boolean(fieldErrors.dailyCap)}
            hint={fieldErrors.dailyCap ?? 'Automatically resets every 24h.'}
          />
        </div>
      </div>

      {submitError && (
        <Alert variant="error" title="Couldn't create the allowance">
          {submitError}
        </Alert>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Continue to funding'}
      </Button>
    </form>
  );
};
