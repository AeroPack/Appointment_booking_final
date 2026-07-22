import React, { useEffect, useRef } from 'react';
import type { ChatMessage, WidgetConfig } from '../types';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  doctorName: string;
  config: WidgetConfig;
  onButtonClick: (value: string) => void;
  onTextSubmit: (text: string) => void;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isTyping,
  doctorName,
  config,
  onButtonClick,
  onTextSubmit,
  onClose,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const positionStyle = config.position === 'bottom-left'
    ? { left: '16px' }
    : { right: '16px' };

  return (
    <div
      data-chatbot-window="true"
      style={{
        position: 'fixed',
        bottom: '80px',
        ...positionStyle,
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        height: '520px',
        maxHeight: 'calc(100vh - 120px)',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
        zIndex: 2147483647,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        background: config.primaryColor,
        color: '#ffffff',
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '15px' }}>
            {doctorName || 'Doctor'}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>
            Appointment Booking
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
            opacity: 0.8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
        >
          x
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 0',
        background: '#f8fafc',
      }}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onButtonClick={onButtonClick}
            primaryColor={config.primaryColor}
          />
        ))}
        {isTyping && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            padding: '0 12px',
            marginBottom: '8px',
          }}>
            <div style={{
              background: '#f1f5f9',
              padding: '10px 14px',
              borderRadius: '4px 16px 16px 16px',
              display: 'flex',
              gap: '4px',
            }}>
              <span style={{ animation: 'typing 1.4s infinite', animationDelay: '0s' }}>&#9679;</span>
              <span style={{ animation: 'typing 1.4s infinite', animationDelay: '0.2s' }}>&#9679;</span>
              <span style={{ animation: 'typing 1.4s infinite', animationDelay: '0.4s' }}>&#9679;</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputArea
        onSend={onTextSubmit}
        disabled={isTyping}
        primaryColor={config.primaryColor}
      />

      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
