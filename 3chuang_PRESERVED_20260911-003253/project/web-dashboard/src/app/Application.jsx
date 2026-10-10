import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell } from './AppShell.jsx';
import { ROUTES, useAppRouter } from './router.js';
import { SessionProvider } from './session/SessionProvider.jsx';
import { FeedbackProvider } from '../components/feedback/FeedbackProvider.jsx';

const LandingPage = lazy(() => import('../pages/landing/LandingPage.jsx'));
const DashboardPage = lazy(() => import('../pages/workflows/DashboardPage.jsx'));
const LoadTasksPage = lazy(() => import('../pages/workflows/LoadTasksPage.jsx'));
const CargoPage = lazy(() => import('../pages/workflows/CargoPage.jsx'));
const ContainerPage = lazy(() => import('../pages/workflows/ContainerPage.jsx'));
const TwinPage = lazy(() => import('../pages/workflows/TwinPage.jsx'));
const CompliancePage = lazy(() => import('../pages/workflows/CompliancePage.jsx'));

const PAGES = Object.freeze({
  [ROUTES.overview]: DashboardPage,
  [ROUTES.tasks]: LoadTasksPage,
  [ROUTES.cargo]: CargoPage,
  [ROUTES.strategy]: ContainerPage,
  [ROUTES.twin]: TwinPage,
  [ROUTES.evidence]: CompliancePage
});

export default function Application() {
  return <FeedbackProvider><RoutedApplication /></FeedbackProvider>;
}

function RoutedApplication() {
  const { route, navigate: changeRoute } = useAppRouter();
  const [workspaceMode,setWorkspaceMode]=useState(()=>localStorage.getItem('portcube.workspaceMode') || (localStorage.getItem('portcube.loadTaskId')?'task':'case'));
  const taskMode=route===ROUTES.tasks || workspaceMode==='task';
  const navigate=(next,options={})=>{
    const mode=next===ROUTES.tasks?'task':options.workspaceMode;
    if(mode==='task' || mode==='case'){setWorkspaceMode(mode);localStorage.setItem('portcube.workspaceMode',mode);}
    changeRoute(next);
  };
  const switchWorkspace=mode=>{setWorkspaceMode(mode);localStorage.setItem('portcube.workspaceMode',mode);changeRoute(mode==='task'?ROUTES.tasks:ROUTES.overview);};
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route]);
  if (route === ROUTES.landing) {
    return <Suspense fallback={<RouteLoading mode="landing" />}><LandingPage navigate={navigate} /></Suspense>;
  }
  const Page = taskMode ? LoadTasksPage : PAGES[route] || DashboardPage;
  return <SessionProvider><AppShell route={route} navigate={navigate} taskMode={taskMode} onWorkspaceChange={switchWorkspace}><Suspense fallback={<RouteLoading mode="workspace" />}><Page route={route} navigate={navigate} /></Suspense></AppShell></SessionProvider>;
}

function RouteLoading({ mode }) {
  return <div className={`route-loading route-loading--${mode}`} role="status"><span /><strong>PORTCUBE</strong><small>正在准备当前体验</small></div>;
}
