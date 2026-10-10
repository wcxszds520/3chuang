import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Moon, Sparkles, Sun, X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileNavDrawer({ open, onClose, triggerRef, items, activeId, onNavigate, contextSummary, marketing, theme, themeLabel, onThemeToggle, onAssistant }) {
  const [present, setPresent] = useState(open);
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const afterClose = useRef(null);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    if (open) { setPresent(true); return undefined; }
    if (!present) return undefined;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-micro')) || 0;
    const timer = window.setTimeout(() => setPresent(false), duration);
    return () => window.clearTimeout(timer);
  }, [open, present]);
  useEffect(() => {
    if (!present) return undefined;
    const root = document.getElementById('root');
    const trigger = triggerRef.current;
    const originalOverflow = document.body.style.overflow;
    const wasInert = root?.inert;
    const originalHidden = root?.getAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    if (root) { root.inert = true; root.setAttribute('aria-hidden', 'true'); }
    panelRef.current?.querySelector('.app-drawer__close')?.focus({ preventScroll: true });
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(node => node.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const desktop = window.matchMedia('(min-width: 768px)');
    const resize = event => { if (event.matches) closeRef.current(); };
    document.addEventListener('keydown', keyboard);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('keydown', keyboard);
      desktop.removeEventListener('change', resize);
      document.body.style.overflow = originalOverflow;
      if (root) {
        root.inert = wasInert;
        if (originalHidden === null) root.removeAttribute('aria-hidden');
        else root.setAttribute('aria-hidden', originalHidden);
      }
      const target = trigger?.getClientRects().length ? trigger : document.querySelector('.app-header__brand');
      target?.focus({ preventScroll: true });
      const action = afterClose.current;
      afterClose.current = null;
      action?.();
    };
  }, [present, triggerRef]);
  if (!present) return null;
  const select = target => { onClose(); onNavigate(target); };
  return createPortal(
    <div className="app-drawer" id="portcube-mobile-nav" data-state={open ? 'open' : 'closing'}>
      <section className="app-drawer__panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="app-drawer__header">
          <strong id={titleId}>PORTCUBE <span>主导航</span></strong>
          <button className="app-header__iconbutton app-drawer__close" type="button" aria-label="关闭导航" onClick={onClose}><X size={20} /></button>
        </header>
        <nav aria-label="主导航">
          {items.map(({ id, target, label, icon: Icon }, index) => (
            <a className="app-drawer__link" href={target} key={id} style={{ animationDelay: `calc(var(--dur-micro) + ${index * 40}ms)` }} aria-current={activeId === id ? 'page' : undefined} onClick={event => { event.preventDefault(); select(target); }}>
              {Icon && <Icon size={20} aria-hidden="true" />}<span>{label}</span><ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ))}
        </nav>
        {contextSummary && <section className="app-drawer__context" aria-label="当前本票摘要">{contextSummary}</section>}
        <footer className="app-drawer__footer">
          <div className="app-drawer__tools">
            <button type="button" onClick={onThemeToggle} aria-label={themeLabel} aria-pressed={theme === 'dark'}>{theme === 'light' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}主题</button>
            {onAssistant && <button type="button" onClick={() => { afterClose.current = onAssistant; onClose(); }}><Sparkles size={18} aria-hidden="true" />智港 AI</button>}
          </div>
          <button className="app-header__ghost" type="button" onClick={() => select(marketing ? '/workspace' : '/')}>
            {marketing ? '进入专业工作台' : '返回公开首页'}<ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <small>智港立方 · 装载决策工作台</small>
        </footer>
      </section>
    </div>, document.body
  );
}
