import { MessagesSquare } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { EmptyState } from '../common/StateViews.jsx';

// The customer's thread. The API only sends their messages and approved replies.
export function ChatThread({ messages }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!messages.length) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No messages yet"
        description="Send a message, or tap one of the samples below. A support agent will reply here."
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((message) =>
        message.senderType === 'CUSTOMER' ? (
          <MessageBubble key={message.id} text={message.text} createdAt={message.createdAt} align="right" tone="brand" />
        ) : (
          <MessageBubble
            key={message.id}
            text={message.text}
            createdAt={message.createdAt}
            align="left"
            label="Verdant & Co Support"
          />
        ),
      )}
      <div ref={endRef} />
    </div>
  );
}
