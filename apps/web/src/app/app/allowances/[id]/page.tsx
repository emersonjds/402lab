import type { Metadata } from 'next';

import { AllowanceDetail } from '@/widgets/allowance-detail/allowance-detail';

export const metadata: Metadata = { title: 'Agent', robots: { index: false } };

interface AllowanceDetailPageProps {
  params: Promise<{ id: string }>;
}

const AllowanceDetailPage = async ({ params }: AllowanceDetailPageProps) => {
  const { id } = await params;

  return <AllowanceDetail allowanceId={id} />;
};

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default AllowanceDetailPage;
