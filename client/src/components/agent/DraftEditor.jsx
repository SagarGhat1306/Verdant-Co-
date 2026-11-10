import { Check, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../utils/constants.js';
import { Alert } from '../common/Alert.jsx';
import { Button } from '../common/Button.jsx';

// The editable AI draft for one message. The parent remounts it (via `key`)
// when the draft changes, so local edits reset.
export function DraftEditor({ draft, onApprove, onRetry }) {
  const [text, setText] = useState(draft.text ?? '');
  const [approving, setApproving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const edited = draft.text != null && text !== draft.text;
  const busy = approving || retrying;

  async function handleApprove() {
    if (!text.trim()) return setError('The reply cannot be empty.');
    setError('');
    setApproving(true);
    try {
      await onApprove(draft.id, text.trim());
    } catch (err) {
      setError(err.message);
      setApproving(false);
    }
  }

  async function handleRetry() {
    setError('');
    setRetrying(true);
    try {
      await onRetry(draft.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="ml-auto w-full max-w-[85%] rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:max-w-[75%]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
          <Sparkles className="size-3.5" aria-hidden />
          {draft.state === 'FAILED' ? 'AI draft failed' : 'AI draft — not visible to the customer'}
        </span>
        {edited && <span className="text-xs text-stone-500">Edited</span>}
      </div>

      {draft.state === 'GENERATING' && (
        <p className="mb-2 flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Generating a draft… You can also write a reply yourself.
        </p>
      )}

      {draft.state === 'FAILED' && (
        <Alert type="error" className="mb-2">
          {draft.errorMessage || 'The AI could not generate a draft.'} Retry, or write the reply yourself.
        </Alert>
      )}

      <label htmlFor={`draft-${draft.id}`} className="sr-only">
        Reply text
      </label>
      <textarea
        id={`draft-${draft.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={busy}
        placeholder="Write the reply the customer will see…"
        className="w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
      />

      <Alert type="error" className="mt-2" onDismiss={() => setError('')}>
        {error}
      </Alert>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleRetry} loading={retrying} disabled={busy}>
          {draft.state === 'READY' ? 'Regenerate' : 'Retry AI'}
        </Button>
        <Button size="sm" icon={Check} onClick={handleApprove} loading={approving} disabled={busy || !text.trim()}>
          {approving ? 'Approving…' : 'Approve & send'}
        </Button>
      </div>
    </div>
  );
}
