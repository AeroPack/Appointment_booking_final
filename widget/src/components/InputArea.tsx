import React, { useState } from 'react';

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  primaryColor: string;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, primaryColor }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        padding: '8px 12px',
        borderTop: '1px solid #e2e8f0',
        gap: '8px',
        background: '#ffffff',
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        style={{
          flex: 1,
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '14px',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = primaryColor;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#e2e8f0';
        }}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        style={{
          background: primaryColor,
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
          opacity: disabled || !text.trim() ? 0.5 : 1,
          fontWeight: '500',
          fontFamily: 'inherit',
        }}
      >
        Send
      </button>
    </form>
  );
};
