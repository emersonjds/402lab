import { ForProviders } from './for-providers';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { ProblemStats } from './problem-stats';
import { ProofPanel } from './proof-panel';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { WaitlistSection } from './waitlist-section';

export const LandingPage = ({ demoUrl }: { demoUrl?: string | undefined }) => (
  <>
    <SiteHeader />
    <main id="main">
      <Hero demoUrl={demoUrl} />
      <ProblemStats />
      <HowItWorks />
      <ProofPanel />
      <ForProviders />
      <WaitlistSection />
    </main>
    <SiteFooter />
  </>
);
