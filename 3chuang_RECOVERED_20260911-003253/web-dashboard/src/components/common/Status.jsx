export function StatusPill({ status, children }) {
  const normalized = String(status || 'neutral').toLowerCase();
  const tone = normalized.includes('pass') || normalized.includes('ready') || normalized.includes('complete') || normalized === 'success'
    ? 'success'
    : normalized.includes('fail') || normalized.includes('error') || normalized.includes('block')
      ? 'danger'
      : normalized.includes('warn') || normalized.includes('pending') || normalized.includes('preview')
        ? 'warning'
        : 'neutral';
  return <span className={`status-pill status-pill--${tone}`}>{children || status}</span>;
}

export function SourceNote({ children }) {
  return <span className="source-note">来源：{children}</span>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state">{Icon && <Icon size={28} aria-hidden="true" />}<h3>{title}</h3><p>{description}</p>{action}</div>;
}
