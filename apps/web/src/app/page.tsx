import { LandingPage } from '@/widgets/landing/landing-page';

const HomePage = () => <LandingPage demoUrl={process.env.NEXT_PUBLIC_DEMO_URL} />;

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default HomePage;
