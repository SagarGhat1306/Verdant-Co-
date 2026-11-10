import { MessageCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../components/common/Alert.jsx';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState, LoadingState } from '../../components/common/StateViews.jsx';
import { ChatThread } from '../../components/customer/ChatThread.jsx';
import { CustomerSelector } from '../../components/customer/CustomerSelector.jsx';
import { MessageComposer } from '../../components/customer/MessageComposer.jsx';
import { usePolling } from '../../hooks/usePolling.js';
import axios from 'axios';
import { getErrorMessage } from '../../utils/apiError.js';
import { BASE_URL } from '../../utils/constants.js';
import { initials } from '../../utils/format.js';

const STORAGE_KEY = 'verdant_customer';

function loadStoredCustomer() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function storeCustomer(customer) {
  try {
    if (customer) localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No storage, so the selection just won't survive a reload.
  }
}

export function CustomerPage() {
  const [customer, setCustomer] = useState(loadStoredCustomer);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadConversation = useCallback(
    async ({ silent = false } = {}) => {
      if (!customer) return;
      if (!silent) setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/customers/${customer.id}/conversation`);
        setMessages(res.data.data.messages);
        if (!silent) setError('');
      } catch (err) {
        if (err.response?.status === 404) {
          // The saved customer is gone (e.g. the database was reset).
          storeCustomer(null);
          setCustomer(null);
          setMessages([]);
        } else if (!silent) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [customer],
  );

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Pick up new agent replies while the page is open.
  usePolling(() => loadConversation({ silent: true }), 3000, Boolean(customer));

  async function handleSelect({ name, phone }) {
    setSelecting(true);
    setError('');
    setNotice('');
    try {
      const res = await axios.post(`${BASE_URL}/customers`, { name, phone });
      setCustomer(res.data.data.customer);
      storeCustomer(res.data.data.customer);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSelecting(false);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !customer) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      await axios.post(`${BASE_URL}/customers/${customer.id}/messages`, { text });
      setDraft('');
      setNotice('Message sent. A support agent will reply here shortly.');
      await loadConversation({ silent: true });
    } catch (err) {
      // Keep the typed text so the customer can try again.
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-4 lg:flex-row">
      <aside className="shrink-0 rounded-xl border border-stone-200 bg-white p-4 lg:w-80 lg:overflow-y-auto">
        <CustomerSelector current={customer} onSelect={handleSelect} busy={selecting} />
      </aside>

      <section className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          {customer ? (
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800">
                {initials(customer.name)}
              </span>
              <div>
                <p className="text-sm font-semibold">Chat with Verdant &amp; Co</p>
                <p className="text-xs text-stone-500">
                  You are {customer.name} · {customer.phone}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold">Chat with Verdant &amp; Co</p>
          )}
          {customer && (
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => loadConversation()} aria-label="Refresh">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50/60">
          {!customer ? (
            <EmptyState
              icon={MessageCircle}
              title="Choose who you are"
              description="Pick a test customer or enter a name and phone number to start a conversation."
            />
          ) : loading ? (
            <LoadingState label="Loading conversation…" />
          ) : (
            <ChatThread messages={messages} />
          )}
        </div>

        <div className="space-y-2 px-3 pt-2 empty:hidden">
          <Alert type="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
          <Alert type="success" onDismiss={() => setNotice('')}>
            {notice}
          </Alert>
        </div>

        <MessageComposer value={draft} onChange={setDraft} onSend={handleSend} sending={sending} disabled={!customer} />
      </section>
    </div>
  );
}
