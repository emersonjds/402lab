import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NewAllowanceWizard } from '@/widgets/new-allowance/new-allowance-wizard';

export const metadata: Metadata = { title: 'Create allowance', robots: { index: false } };

const NewAllowancePage = () => (
  <Suspense fallback={null}>
    <NewAllowanceWizard />
  </Suspense>
);

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default NewAllowancePage;
