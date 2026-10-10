import type { Metadata } from 'next';

import { ConnectWallet } from '@/widgets/connect-wallet/connect-wallet';

export const metadata: Metadata = { title: 'Connect wallet', robots: { index: false } };

const ConnectPage = () => <ConnectWallet />;

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default ConnectPage;
