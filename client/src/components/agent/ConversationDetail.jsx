import { ArrowLeft, CheckCheck, Phone, RefreshCw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePolling } from '../../hooks/usePolling.js';
import axios from 'axios';
import { getErrorCode, getErrorMessage } from '../../utils/apiError.js';
import { BASE_URL } from '../../utils/constants.js';
import { formatDateTime, initials } from '../../utils/format.js';
import { Alert } from '../common/Alert.jsx';
import { Button } from '../common/Button.jsx';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { LoadingState } from '../common/StateViews.jsx';
import { DraftEditor } from './DraftEditor.jsx';

export function ConversationDetail({ conversationId, onChanged }) {
  const { token } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const endRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversation(res.data.data.conversation);
        setError('');
      } catch (err) {
        if (!silent) setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, conversationId],
  );

  useEffect(() => {
    setConversation(null);
    setSuccess('');
    load();
  }, [load]);

  const generating = conversation?.messages.some((m) => m.draft?.state === 'GENERATING');
  usePolling(() => load({ silent: true }), generating ? 4000 : 10000);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation?.messages.length]);

  async function handleApprove(draftId, text) {
    setSuccess('');
    try {
      await axios.post(`${BASE_URL}/drafts/${draftId}/approve`, { text }, authHeaders);
      setSuccess('Reply approved. The customer can now see it.');
    } catch (err) {
      // Someone else got there first. Refresh to show what really happened.
      if (getErrorCode(err) === 'ALREADY_APPROVED') {
        setError('This draft was already approved, possibly by another agent. The conversation has been refreshed.');
        await load({ silent: true });
        onChanged?.();
      }
      throw new Error(getErrorMessage(err)); // shown in the draft box
    }
    await load({ silent: true });
    onChanged?.();
  }

  async function handleRetry(draftId) {
    try {
      await axios.post(`${BASE_URL}/drafts/${draftId}/retry`, {}, authHeaders);
    } catch (err) {
      throw new Error(getErrorMessage(err)); // shown in the draft box
    } finally {
      // Refresh either way; a failed retry also updates the error.
      await load({ silent: true });
      onChanged?.();
    }
  }

  if (loading && !conversation) return <LoadingState label="Loading conversation…" />;
  if (error && !conversation) return <Alert type="error" className="m-4">{error}</Alert>;
  if (!conversation) return null;

  const { customer, messages } = conversation;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <Link to="/agent" className="rounded-md p-1 text-stone-500 hover:bg-stone-100 md:hidden" aria-label="Back to list">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800">
          {initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{customer.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" aria-hidden />
              {customer.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" aria-hidden />
              {customer.externalId}
            </span>
            <span>Customer since {formatDateTime(customer.createdAt)}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load()} aria-label="Refresh conversation">
          <span className="hidden lg:inline">Refresh</span>
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-stone-50/60 p-4">
        {messages.map((message) =>
          message.senderType === 'CUSTOMER' ? (
            <div key={message.id} className="space-y-2">
              <MessageBubble
                text={message.text}
                createdAt={message.createdAt}
                align="left"
                label={customer.name}
                footer={
                  message.draftStatus === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 text-brand-700">
                      <CheckCheck className="size-3" aria-hidden />
                      Replied
                    </span>
                  )
                }
              />
              {message.draft && message.draft.state !== 'APPROVED' && (
                <DraftEditor
                  key={`${message.draft.id}:${message.draft.text ?? ''}:${message.draft.state}`}
                  draft={message.draft}
                  onApprove={handleApprove}
                  onRetry={handleRetry}
                />
              )}
            </div>
          ) : (
            <MessageBubble
              key={message.id}
              text={message.text}
              createdAt={message.createdAt}
              align="right"
              tone="soft"
              label="Agent reply"
            />
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-stone-200 bg-white px-4 py-2 empty:hidden">
        <Alert type="success" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
        <Alert type="error" onDismiss={() => setError('')}>
          {conversation && error}
        </Alert>
      </div>
    </div>
  );
}
