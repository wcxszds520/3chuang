import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';

const FeedbackContext = createContext(null);
const ICONS = { success: CheckCircle2, error: CircleAlert, warning: TriangleAlert, info: Info };

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, options = {}) => {
    const id = options.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duration = Math.min(5000, Math.max(3000, Number(options.duration || 4000)));
    const toast = {
      id,
      message,
      title: options.title || '',
      variant: options.variant || 'info',
      duration
    };
    setToasts((current) => [...current.filter((item) => item.id !== id), toast].slice(-4));
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="toast-region" role="region" aria-label="操作通知" aria-live="polite">
          {toasts.map((toast) => {
            const Icon = ICONS[toast.variant] || Info;
            return (
              <div className={`toast toast--${toast.variant}`} key={toast.id} role={toast.variant === 'error' ? 'alert' : 'status'}>
                <Icon size={19} aria-hidden="true" />
                <div className="toast__copy">
                  {toast.title && <strong>{toast.title}</strong>}
                  <span>{toast.message}</span>
                </div>
                <button className="icon-button icon-button--quiet" type="button" onClick={() => dismiss(toast.id)} aria-label="关闭通知">
                  <X size={17} />
                </button>
                <span className="toast__timer" style={{ animationDuration: `${toast.duration}ms` }} />
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}
