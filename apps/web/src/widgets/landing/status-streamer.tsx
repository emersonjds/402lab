export const StatusStreamer = () => (
  <div className="overflow-hidden border-b border-line/60 bg-surface px-4 py-1.5 sm:px-6">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 font-mono text-xs text-muted">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-brand-500">
          <span aria-hidden="true" className="inline-block size-1.5 animate-pulse rounded-full bg-brand-500" />
          NETWORK: SOLANA DEVNET
        </span>
        <span className="hidden text-line md:inline">|</span>
        <span className="hidden truncate md:inline">SPEC: RFC 9110 §15.5.3 (HTTP 402 PAYMENT REQUIRED)</span>
        <span className="hidden text-line lg:inline">|</span>
        <span className="hidden tabular-nums lg:inline">AVG_FINALITY: 412ms</span>
      </div>
      <div className="hidden shrink-0 items-center gap-2 tabular-nums text-blue-light-400 sm:flex">
        <span>PROGRAM ID: 402L...Ab7x</span>
      </div>
    </div>
  </div>
);
