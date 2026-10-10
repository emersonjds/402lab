import { explorerTxUrl } from '@402lab/shared';

export const SolscanLink = ({ signature }: { signature: string }) => (
  <a
    href={explorerTxUrl(signature)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex min-h-11 items-center gap-1 text-sm text-cyan underline-offset-4 hover:underline"
  >
    View on Solscan{' '}
    <span aria-hidden="true">↗</span>
    <span className="sr-only">(opens in a new tab)</span>
  </a>
);
