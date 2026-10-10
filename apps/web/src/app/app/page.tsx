import { Card } from '@/components/ui/card';

const AppHomePage = () => (
  <div>
    <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Allowances</h1>
    <Card className="mt-6 p-6 text-sm text-muted">Allowance management ships next.</Card>
  </div>
);

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default AppHomePage;
