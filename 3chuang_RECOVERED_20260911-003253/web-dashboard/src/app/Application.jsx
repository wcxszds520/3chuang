import { lazy, Suspense, useEffect } from 'react';
import { AppShell } from './AppShell.jsx';
import { ROUTES, useAppRouter } from './router.js';
import { SessionProvider } from './session/SessionProvider.jsx';
import { FeedbackProvider } from '../components/feedback/FeedbackProvider.jsx';

const LandingPage = lazy(() => import('../pages/landing/LandingPage.jsx'));
const DashboardPage = lazy(() => import('../pages/workflows/DashboardPage.jsx'));
const CargoPage = lazy(() => import('../pages/workflows/CargoPage.jsx'));
const ContainerPage = lazy(() => import('../pages/workflows/ContainerPage.jsx'));
const TwinPage = lazy(() => import('../pages/workflows/TwinPage.jsx'));
const CompliancePage = lazy(() => import('../pages/workflows/CompliancePage.jsx'));
const ReviewPage = lazy(() => import('../pages/review/ReviewPage.jsx'));

const PAGES = Object.freeze({
  [ROUTES.overview]: DashboardPage,
  [ROUTES.cargo]: CargoPage,
  [ROUTES.strategy]: ContainerPage,
  [ROUTES.twin]: TwinPage,
  [ROUTES.evidence]: CompliancePage
});

export default function Application() {
  return <FeedbackProvider><RoutedApplication /></FeedbackProvider>;
}

function RoutedApplication() {
  const { route, navigate } = useAppRouter();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route]);
  if (route === ROUTES.landing) {
    return <Suspense fallback={<RouteLoading mode="landing" />}><LandingPage navigate={navigate} /></Suspense>;
  }
  const Page = PAGES[route] || DashboardPage;
  if (route === ROUTES.review) return <SessionProvider><Suspense fallback={<RouteLoading mode="workspace" />}><ReviewPage navigate={navigate} /></Suspense></SessionProvider>;
  return <SessionProvider><AppShell route={route} navigate={navigate}><Suspense fallback={<RouteLoading mode="workspace" />}><Page navigate={navigate} /></Suspense></AppShell></SessionProvider>;
}

function RouteLoading({ mode }) {
  return <div className={`route-loading route-loading--${mode}`} role="status"><span /><strong>PORTCUBE</strong><small>正在准备当前体验</small></div>;
}
