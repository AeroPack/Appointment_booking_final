import React from 'react';
import type { ChatMessage, ButtonOption } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onButtonClick?: (value: string) => void;
  primaryColor: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onButtonClick, primaryColor }) => {
  const isBot = message.type === 'bot';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isBot ? 'flex-start' : 'flex-end',
      marginBottom: '8px',
      padding: '0 12px',
    }}>
      <div style={{
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          background: isBot ? '#f1f5f9' : primaryColor,
          color: isBot ? '#1e293b' : '#ffffff',
          padding: '10px 14px',
          borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          fontSize: '14px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
        {message.buttons && message.buttons.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '8px',
          }}>
            {message.buttons.map((btn: ButtonOption) => (
              <button
                key={btn.value}
                onClick={() => onButtonClick?.(btn.value)}
                style={{
                  background: '#ffffff',
                  color: primaryColor,
                  border: `1px solid ${primaryColor}`,
                  borderRadius: '16px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontWeight: '500',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = primaryColor;
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = primaryColor;
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
