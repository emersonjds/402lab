'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge } from './badge';

const SOON_NETWORKS = ['Solana Mainnet', 'Base', 'Polygon', 'Arbitrum'] as const;

export const DevnetBadge = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    activeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const handlePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handlePointer);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handlePointer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Network: Solana Devnet"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex min-h-11 items-center rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-400"
      >
        <Badge color="warning">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-400" />
          DEVNET
          <ChevronDown
            aria-hidden="true"
            className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Badge>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Network"
          className="fixed inset-x-4 top-16 z-50 mt-1 rounded-[8px] border border-line bg-raised p-1 shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:w-64"
        >
          <li
            ref={activeRef}
            role="option"
            aria-selected="true"
            tabIndex={0}
            onClick={close}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                close();
              }
            }}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[6px] px-3 py-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-warning-400"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-400" />
            <span className="flex flex-1 flex-col">
              <span className="text-sm text-text">Solana Devnet</span>
              <span className="font-mono text-xs text-muted">USDC · live</span>
            </span>
            <Check aria-hidden="true" className="size-4 text-lime" />
          </li>
          {SOON_NETWORKS.map((name) => (
            <li
              key={name}
              role="option"
              aria-selected="false"
              aria-disabled="true"
              className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-[6px] px-3 py-2"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-line" />
              <span className="flex-1 text-sm text-muted">{name}</span>
              <Badge>Soon</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
