import { formatTime } from '../../utils/format.js';

// Used by both views. `align` is from the viewer's side, so in the Customer
// View the customer's own messages sit on the right.
export function MessageBubble({ text, createdAt, align = 'left', label, tone = 'neutral', footer }) {
  const tones = {
    neutral: 'bg-white border border-stone-200 text-stone-800',
    brand: 'bg-brand-700 text-white',
    soft: 'bg-brand-50 border border-brand-100 text-stone-800',
  };
  const isRight = align === 'right';

  return (
    <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'}`}>
      {label && <span className="mb-1 px-1 text-xs font-medium text-stone-500">{label}</span>}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words sm:max-w-[75%] ${tones[tone]} ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}`}>
        {text}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1 text-xs text-stone-400">
        <time dateTime={createdAt}>{formatTime(createdAt)}</time>
        {footer}
      </div>
    </div>
  );
}
