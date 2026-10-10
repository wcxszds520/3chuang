import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, Moon, Search, Sun, UserRound } from 'lucide-react';
import { CASE_NAV, MARKETING_NAV, matchNav } from '../../app/navigation.js';
import { useTheme } from '../../app/theme.js';
import { ROUTES } from '../../app/router.js';
import { Dialog } from '../feedback/Overlays.jsx';
import MobileNavDrawer from './MobileNavDrawer.jsx';

export default function AppHeader({ route, navigate, variant = 'workspace', assistant, contextSummary }) {
  const marketing = variant === 'marketing';
  const items = marketing ? MARKETING_NAV : CASE_NAV;
  const { theme, toggle } = useTheme();
  const [compact, setCompact] = useState(() => window.scrollY > 24);
  const [section, setSection] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  const burgerRef = useRef(null);
  const sessionRef = useRef(null);
  const assistantRef = useRef(null);
  const searchInputRef = useRef(null);
  const measured = useRef(false);
  const activeId = marketing ? section : matchNav(items, route)?.id;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCompact(window.scrollY > 24);
      if (marketing) {
        const boundary = Math.max(64, window.innerHeight * .35);
        const current = items.filter(item => {
          const element = document.getElementById(item.id);
          return element && element.getBoundingClientRect().top <= boundary;
        }).at(-1);
        setSection(current?.id || '');
      }
    };
    const scroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      window.cancelAnimationFrame(frame);
    };
  }, [items, marketing]);

  const measure = useCallback((animate = true) => {
    const nav = navRef.current;
    const bar = indicatorRef.current;
    if (!nav || !bar) return;
    const label = nav.querySelector('[aria-current="page"] .app-header__label');
    if (!label) { bar.style.opacity = '0'; return; }
    const parent = nav.getBoundingClientRect();
    const bounds = label.getBoundingClientRect();
    if (!animate || !measured.current) bar.style.transition = 'none';
    bar.style.transform = `translateX(${bounds.left - parent.left}px) scaleX(${bounds.width})`;
    bar.style.opacity = '1';
    measured.current = true;
    if (!animate || bar.style.transition === 'none') {
      window.requestAnimationFrame(() => { if (bar.isConnected) bar.style.removeProperty('transition'); });
    }
  }, []);
  useLayoutEffect(() => { measure(); }, [activeId, compact, measure]);
  useEffect(() => {
    let disposed = false;
    const remeasure = () => { if (!disposed) measure(false); };
    const observer = new ResizeObserver(remeasure);
    if (navRef.current) {
      observer.observe(navRef.current);
      navRef.current.querySelectorAll('.app-header__label').forEach(label => observer.observe(label));
    }
    document.fonts?.ready.then(remeasure);
    document.fonts?.addEventListener('loadingdone', remeasure);
    return () => { disposed = true; observer.disconnect(); document.fonts?.removeEventListener('loadingdone', remeasure); };
  }, [measure]);

  useEffect(() => {
    if (marketing) return undefined;
    const keyboard = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
      if (event.key === 'Escape' && sessionRef.current?.open) { sessionRef.current.open = false; sessionRef.current.querySelector('summary')?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [marketing]);

  const onNavigate = target => {
    if (target.startsWith('#')) {
      setSection(target.slice(1));
      document.getElementById(target.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target}`);
    } else navigate(target);
    if (sessionRef.current) sessionRef.current.open = false;
  };
  const themeLabel = theme === 'light' ? '切换为深色主题' : '切换为浅色主题';
  const filtered = CASE_NAV.filter(item => item.label.includes(query.trim()));
  return <>
    <header className={`app-header${compact ? ' app-header--compact' : ''}`} data-variant={variant} data-compact={compact}>
      <div className="app-header__surface" aria-hidden="true" />
      <div className="app-header__inner">
        <a className="app-header__brand" href={marketing ? '#top' : ROUTES.overview} aria-label={marketing ? '智港立方 PORTCUBE 首页' : '智港立方 PORTCUBE 工作台'} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate(marketing ? '#top' : ROUTES.overview); }}>
          <span className="app-header__logo" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg></span><span>PORTCUBE</span>
        </a>
        <span className="app-header__mobile-title">{marketing ? '首页' : matchNav(items, route)?.label}</span>
        <nav className="app-header__nav" aria-label="主导航" ref={navRef}>
          {items.map(({ id, target, label, icon: Icon }) => <a className="app-header__link" href={target} key={id} aria-current={activeId === id ? 'page' : undefined} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate(target); }}>
            {Icon && <Icon size={16} aria-hidden="true" />}<span className="app-header__label">{label}</span>
          </a>)}
          <span className="app-header__indicator" ref={indicatorRef} aria-hidden="true" />
        </nav>
        <div className="app-header__actions">
          {!marketing && <button className="app-header__iconbutton app-header__search" type="button" onClick={() => setSearchOpen(true)} aria-label="查找页面" title="查找页面（Ctrl / ⌘ K）"><Search size={16} aria-hidden="true" /><kbd>⌘ K</kbd></button>}
          <button className="app-header__iconbutton app-header__theme" type="button" onClick={toggle} aria-label={themeLabel} aria-pressed={theme === 'dark'} title={themeLabel}>{theme === 'light' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}</button>
          {marketing ? <button className="app-header__ghost app-header__entry" type="button" onClick={() => onNavigate(ROUTES.overview)}>进入专业工作台<ArrowUpRight size={15} aria-hidden="true" /></button> : <>
            {assistant && <div className="app-header__assistant" ref={assistantRef}>{assistant}</div>}
            <details className="app-header__session" ref={sessionRef}>
              <summary className="app-header__iconbutton" aria-label="会话菜单" title="会话菜单"><UserRound size={16} aria-hidden="true" /></summary>
              <div className="app-header__popover"><strong>当前工作区</strong><button type="button" onClick={() => onNavigate(ROUTES.landing)}>返回公开首页<ArrowUpRight size={15} aria-hidden="true" /></button></div>
            </details>
          </>}
          <button className="app-header__iconbutton app-header__burger" type="button" ref={burgerRef} onClick={() => setDrawerOpen(true)} aria-label="打开导航" aria-expanded={drawerOpen} aria-controls="portcube-mobile-nav"><Menu size={20} aria-hidden="true" /></button>
        </div>
      </div>
    </header>
    <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} triggerRef={burgerRef} items={items} activeId={activeId} onNavigate={onNavigate} contextSummary={contextSummary} marketing={marketing} theme={theme} themeLabel={themeLabel} onThemeToggle={toggle} onAssistant={assistant ? () => { setDrawerOpen(false); assistantRef.current?.querySelector('button')?.click(); } : undefined} />
    {!marketing && <Dialog open={searchOpen} onClose={() => { setSearchOpen(false); setQuery(''); }} title="查找页面" description="快速打开当前工作区的页面" size="sm" initialFocusRef={searchInputRef}>
      <label className="app-header__searchlabel" htmlFor="portcube-page-search">页面名称</label>
      <input className="app-header__searchinput" id="portcube-page-search" ref={searchInputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
      <div className="app-header__searchresults">{filtered.map(({ id, target, label, icon: Icon }) => <button type="button" key={id} onClick={() => { setSearchOpen(false); setQuery(''); onNavigate(target); }}><Icon size={16} aria-hidden="true" />{label}<ArrowUpRight size={14} aria-hidden="true" /></button>)}{!filtered.length && <p role="status">没有匹配的页面</p>}</div>
    </Dialog>}
  </>;
}
