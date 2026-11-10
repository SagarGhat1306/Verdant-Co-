import { MessagesSquare, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConversationDetail } from '../../components/agent/ConversationDetail.jsx';
import { ConversationList } from '../../components/agent/ConversationList.jsx';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/StateViews.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePolling } from '../../hooks/usePolling.js';
import axios from 'axios';
import { getErrorMessage } from '../../utils/apiError.js';
import { BASE_URL } from '../../utils/constants.js';

export function AgentDashboard() {
  const { token } = useAuth();
  const { id: selectedId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(res.data.data.conversations);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  usePolling(loadList, 10000);

  return (
    <div className="mx-auto flex h-full max-w-7xl md:p-4">
      <div className="flex h-full w-full overflow-hidden border-stone-200 bg-white md:rounded-xl md:border">
        {/* On mobile the list and the conversation are separate screens. */}
        <aside
          className={`w-full shrink-0 flex-col border-r border-stone-200 md:flex md:w-80 lg:w-96 ${
            selectedId ? 'hidden' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h1 className="text-sm font-semibold">Conversations</h1>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadList} aria-label="Refresh conversations" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              loading={loading}
              error={error}
              selectedId={selectedId}
            />
          </div>
        </aside>

        <section className={`min-w-0 flex-1 ${selectedId ? 'block' : 'hidden md:block'}`}>
          {selectedId ? (
            <ConversationDetail key={selectedId} conversationId={selectedId} onChanged={loadList} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="Select a conversation"
              description="Open a conversation to review the AI draft, edit it and approve the reply."
            />
          )}
        </section>
      </div>
    </div>
  );
}
