import { SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_LENGTH, SAMPLE_MESSAGES } from '../../utils/constants.js';
import { Button } from '../common/Button.jsx';

export function MessageComposer({ value, onChange, onSend, sending, disabled }) {
  const canSend = value.trim().length > 0 && !sending && !disabled;

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="space-y-2 border-t border-stone-200 bg-white p-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Sample messages">
        {SAMPLE_MESSAGES.map((sample) => (
          <button
            key={sample}
            type="button"
            disabled={disabled || sending}
            onClick={() => onChange(sample)}
            className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600 hover:border-stone-300 hover:bg-white disabled:opacity-50"
            title={sample}
          >
            {sample.length > 38 ? `${sample.slice(0, 36)}…` : sample}
          </button>
        ))}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSend();
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={disabled ? 'Choose a customer to start chatting' : 'Type your message…'}
          aria-label="Message"
          className="min-h-11 flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
        />
        <Button type="submit" icon={SendHorizontal} loading={sending} disabled={!canSend} className="h-11">
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
