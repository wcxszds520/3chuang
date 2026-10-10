import { useCallback, useEffect, useState } from 'react';

export const ROUTES = Object.freeze({
  review: '/review',
  landing: '/', overview: '/workspace', cargo: '/workspace/cargo', strategy: '/workspace/planning',
  twin: '/workspace/twin', evidence: '/workspace/readiness', delivery: '/workspace/readiness',
  home: '/', dashboard: '/workspace', container: '/workspace/planning',
  compliance: '/workspace/readiness', report: '/workspace/readiness'
});

const VALID = new Set([ROUTES.review, ROUTES.landing, ROUTES.overview, ROUTES.cargo, ROUTES.strategy, ROUTES.twin, ROUTES.evidence]);
const ALIASES = Object.freeze({
  '/dashboard': ROUTES.overview, '/cargo': ROUTES.cargo, '/strategy': ROUTES.strategy,
  '/container': ROUTES.strategy, '/twin': ROUTES.twin, '/evidence': ROUTES.evidence,
  '/compliance': ROUTES.evidence, '/report': ROUTES.evidence, '/delivery': ROUTES.evidence,
  '/workspace/evidence': ROUTES.evidence, '/workspace/delivery': ROUTES.evidence
});

export function normalizeRoute(value) {
  const input = value ?? `${globalThis.location?.pathname || '/'}${globalThis.location?.hash || ''}`;
  const text = String(input);
  const hashRoute = text.includes('#/') ? text.slice(text.indexOf('#') + 1) : text.startsWith('#') ? text.slice(1) : '';
  const raw = (hashRoute || text).split('?')[0].replace(/\/$/, '') || ROUTES.landing;
  const normalized = ALIASES[raw] || raw;
  return VALID.has(normalized) ? normalized : ROUTES.landing;
}

export function useAppRouter() {
  const [route, setRoute] = useState(() => normalizeRoute());
  useEffect(() => {
    const handle = () => setRoute(normalizeRoute());
    window.addEventListener('popstate', handle);
    window.addEventListener('hashchange', handle);
    const initial = normalizeRoute();
    if (window.location.hash.startsWith('#/') || window.location.pathname !== initial) {
      window.history.replaceState(null, '', `${initial}${window.location.search}`);
    }
    setRoute(initial);
    return () => {
      window.removeEventListener('popstate', handle);
      window.removeEventListener('hashchange', handle);
    };
  }, []);
  const navigate = useCallback((next) => {
    const normalized = normalizeRoute(next);
    if (window.location.pathname === normalized && !window.location.hash) setRoute(normalized);
    else {
      window.history.pushState(null, '', normalized);
      setRoute(normalized);
    }
  }, []);
  return { route, navigate };
}

export const useHashRouter = useAppRouter;
