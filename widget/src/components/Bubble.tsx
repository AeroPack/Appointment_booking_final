import React from 'react';

interface BubbleProps {
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  isOpen: boolean;
  onClick: () => void;
}

export const Bubble: React.FC<BubbleProps> = ({ primaryColor, position, isOpen, onClick }) => {
  const positionStyle = position === 'bottom-left'
    ? { left: '16px' }
    : { right: '16px' };

  return (
    <button
      data-chatbot-bubble="true"
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '16px',
        ...positionStyle,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: primaryColor,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        transition: 'transform 0.2s ease',
        fontFamily: 'sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {isOpen ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
    </button>
  );
};
