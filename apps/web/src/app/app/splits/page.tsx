import { Card } from '@/components/ui/card';

const SplitsPage = () => (
  <div>
    <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Splits</h1>
    <Card className="mt-6 p-6 text-sm text-muted">Provider and platform splits ship next.</Card>
  </div>
);

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default SplitsPage;
