import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/widgets/app-shell/app-shell';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

const AppLayout = ({ children }: { children: ReactNode }) => <AppShell>{children}</AppShell>;

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default AppLayout;
