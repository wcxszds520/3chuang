import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const activeOverlays = new Set();

function useOverlay(open, onClose, panelRef, initialFocusRef) {
  const returnFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    const panel = panelRef.current;
    const first = initialFocusRef?.current || panel?.querySelector(FOCUSABLE);
    window.requestAnimationFrame(() => (first || panel)?.focus({ preventScroll: true }));

    const handleKey = (event) => {
      const topPanel = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter((node) => node.getAttribute('aria-hidden') !== 'true').at(-1);
      if (topPanel !== panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key === 'Tab' && panel) {
        const focusable = [...panel.querySelectorAll(FOCUSABLE)];
        if (!focusable.length) return;
        const firstNode = focusable[0];
        const lastNode = focusable.at(-1);
        if (event.shiftKey && document.activeElement === firstNode) {
          event.preventDefault();
          lastNode.focus();
        } else if (!event.shiftKey && document.activeElement === lastNode) {
          event.preventDefault();
          firstNode.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    activeOverlays.add(panel);
    document.body.dataset.overlayOpen = 'true';
    return () => {
      document.removeEventListener('keydown', handleKey);
      activeOverlays.delete(panel);
      if (!activeOverlays.size) delete document.body.dataset.overlayOpen;
      const target = returnFocus.current;
      window.requestAnimationFrame(() => target?.isConnected && target.focus({ preventScroll: true }));
    };
  }, [open, panelRef, initialFocusRef]);
}

function usePresence(open, exitMs) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [exitMs, mounted, open]);
  return { mounted, closing: mounted && !open };
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, initialFocusRef }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const presence = usePresence(open, 220);
  useOverlay(open && presence.mounted, onClose, panelRef, initialFocusRef);
  if (!presence.mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`overlay ${presence.closing ? 'overlay--closing' : ''}`} onMouseDown={(event) => open && closeOnBackdrop && event.target === event.currentTarget && onClose?.()}>
      <section className={`dialog dialog--${size} ${presence.closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} ref={panelRef} tabIndex={-1}>
        <header className="overlay__header">
          <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <button className="icon-button icon-button--quiet" type="button" onClick={onClose} aria-label="关闭对话框"><X size={20} /></button>
        </header>
        <div className="overlay__body">{children}</div>
        {footer && <footer className="overlay__footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, suspended = false }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const presence = usePresence(open, 240);
  useOverlay(open && presence.mounted, onClose, panelRef);
  if (!presence.mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`overlay overlay--drawer ${presence.closing ? 'overlay--closing' : ''}`} style={suspended ? { visibility: 'hidden', pointerEvents: 'none' } : undefined} inert={suspended ? '' : undefined} onMouseDown={(event) => open && !suspended && closeOnBackdrop && event.target === event.currentTarget && onClose?.()}>
      <aside className={`drawer drawer--${size} ${presence.closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open || suspended} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} ref={panelRef} tabIndex={-1}>
        <header className="overlay__header">
          <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <button className="icon-button icon-button--quiet" type="button" onClick={onClose} aria-label="关闭抽屉"><X size={20} /></button>
        </header>
        <div className="overlay__body">{children}</div>
        {footer && <footer className="overlay__footer">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = '确认操作', description, confirmLabel = '确认', busy = false, tone = 'danger', consequence = '此操作会更新当前订单，已有装箱方案与出运复核结果需要重新生成。' }) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdrop={!busy}
      footer={<>
        <button className="button button--secondary" type="button" onClick={onClose} disabled={busy}>取消</button>
        <button className={`button button--${tone}`} type="button" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button>
      </>}
    >
      {consequence && <p className="confirm-copy">{consequence}</p>}
    </Dialog>
  );
}

export function InlineLoading({ label = '正在加载' }) {
  return <span className="inline-loading" role="status"><span className="spinner" aria-hidden="true" />{label}</span>;
}
