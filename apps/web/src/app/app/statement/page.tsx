import { Suspense } from 'react';

import { StatementView } from '@/widgets/statement/statement-view';

const StatementPage = () => (
  <Suspense fallback={null}>
    <StatementView />
  </Suspense>
);

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default StatementPage;
