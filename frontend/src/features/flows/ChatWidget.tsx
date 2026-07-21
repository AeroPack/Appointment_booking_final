import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  useStartFlowSessionMutation,
  useRespondToFlowSessionMutation,
  useGetFlowSessionMessagesQuery,
} from './chatApi';
import type { FlowMessage } from './chatApi';

interface ChatWidgetProps {
  doctorId: string;
  triggerType?: 'book' | 'reschedule' | 'cancel';
  primaryColor?: string;
}

export function ChatWidget({ doctorId, triggerType = 'book', primaryColor = '#2563eb' }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [allMessages, setAllMessages] = useState<FlowMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [startSession, { isLoading: isStarting }] = useStartFlowSessionMutation();
  const [respondToSession, { isLoading: isResponding }] = useRespondToFlowSessionMutation();

  const { data: polledMessages } = useGetFlowSessionMessagesQuery(sessionId!, {
    skip: !sessionId,
    pollingInterval: isOpen ? 3000 : 0,
  });

  useEffect(() => {
    if (polledMessages && Array.isArray(polledMessages)) {
      setAllMessages(polledMessages);
    }
  }, [polledMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  const handleOpen = async () => {
    setIsOpen(true);
    if (!sessionId) {
      try {
        const result = await startSession({ doctor_id: doctorId, trigger_type: triggerType }).unwrap();
        setSessionId(result.session.id);
        setAllMessages(result.messages);
      } catch {
        // Error handled by RTK Query
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isResponding) return;
    const userMessage: FlowMessage = {
      id: `temp_${Date.now()}`,
      session_id: sessionId,
      direction: 'inbound',
      node_id: null,
      content: input.trim(),
      message_type: 'text',
      channel_message_id: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setAllMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      await respondToSession({ sessionId, input: input.trim() }).unwrap();
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-3 w-80 h-96 bg-background rounded-lg shadow-xl border flex flex-col overflow-hidden">
          <div
            className="p-3 text-white flex items-center justify-between"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="font-medium text-sm">Chat with us</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-7 w-7 p-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {allMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.direction === 'inbound'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[10px] mt-1 opacity-60">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {(isStarting || isResponding) && (
              <div className="flex justify-start">
                <div className="bg-muted px-3 py-2 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isStarting || isResponding}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isStarting || isResponding}
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="rounded-full h-14 w-14 shadow-lg"
        style={{ backgroundColor: primaryColor }}
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </Button>
    </div>
  );
}
