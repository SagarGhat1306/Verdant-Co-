import { AlertTriangle, Inbox, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeDay, initials } from '../../utils/format.js';
import { Alert } from '../common/Alert.jsx';
import { EmptyState, LoadingState } from '../common/StateViews.jsx';

function DraftBadge({ pending, failed }) {
  if (failed > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle className="size-3" aria-hidden />
        AI failed
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Sparkles className="size-3" aria-hidden />
        {pending} draft{pending > 1 ? 's' : ''}
      </span>
    );
  }
  return null;
}

export function ConversationList({ conversations, loading, error, selectedId }) {
  if (loading && !conversations.length) return <LoadingState label="Loading conversations…" />;
  if (error && !conversations.length) return <Alert type="error" className="m-3">{error}</Alert>;
  if (!conversations.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="No conversations yet"
        description="Messages from the Customer View or the webhook will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-stone-100">
      {conversations.map((conversation) => {
        const { customer, latestMessage } = conversation;
        const active = conversation.id === selectedId;
        const preview = latestMessage
          ? `${latestMessage.senderType === 'AGENT' ? 'You: ' : ''}${latestMessage.text}`
          : 'No messages';

        return (
          <li key={conversation.id}>
            <Link
              to={`/agent/conversations/${conversation.id}`}
              className={`flex gap-3 px-4 py-3 transition-colors ${active ? 'bg-brand-50' : 'hover:bg-stone-50'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                {initials(customer.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{customer.name}</p>
                  <time className="shrink-0 text-xs text-stone-400" dateTime={conversation.lastMessageAt}>
                    {formatRelativeDay(conversation.lastMessageAt)}
                  </time>
                </div>
                <p className="text-xs text-stone-500">{customer.phone}</p>
                <p className="mt-1 truncate text-sm text-stone-600">{preview}</p>
                <div className="mt-1.5 empty:hidden">
                  <DraftBadge pending={conversation.pendingDrafts} failed={conversation.failedDrafts} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
