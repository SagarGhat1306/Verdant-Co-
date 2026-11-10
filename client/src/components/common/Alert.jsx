import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const styles = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  success: { box: 'border-brand-100 bg-brand-50 text-brand-800', Icon: CheckCircle2 },
  info: { box: 'border-stone-200 bg-stone-50 text-stone-700', Icon: Info },
};

export function Alert({ type = 'info', children, onDismiss, className = '' }) {
  if (!children) return null;
  const { box, Icon } = styles[type];

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${box} ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
