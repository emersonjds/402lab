'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { Allowance } from '@/shared/api/schemas';

import { ConfigureStep } from './configure-step';
import { FundStep } from './fund-step';

interface StepBadgeProps {
  step: number;
  active: boolean;
  label: string;
}

const StepBadge = ({ step, active, label }: StepBadgeProps) => (
  <div className={`flex items-center gap-2 ${active ? 'text-brand-400' : 'text-muted'}`}>
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
        active ? 'border-brand-400 bg-brand-500/10' : 'border-line'
      }`}
    >
      {step}
    </span>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

export const NewAllowanceWizard = () => {
  const searchParams = useSearchParams();
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">
        Create agent allowance
      </h1>
      <p className="mt-1 text-sm text-muted">Configure deterministic spend limits, then fund the vault.</p>

      <div className="mt-6 flex items-center gap-4">
        <StepBadge step={1} active={!allowance} label="Configure" />
        <div className="h-px flex-1 bg-line" />
        <StepBadge step={2} active={Boolean(allowance)} label="Fund" />
      </div>

      <div className="mt-8">
        {allowance ? (
          <FundStep allowance={allowance} />
        ) : (
          <ConfigureStep
            initialSessionAddress={searchParams.get('session') ?? ''}
            onCreated={setAllowance}
          />
        )}
      </div>
    </div>
  );
};
