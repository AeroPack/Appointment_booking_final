import React from 'react';
import type { WidgetConfig } from '../types';
import { useChat } from '../hooks/useChat';
import { Bubble } from './Bubble';
import { ChatWindow } from './ChatWindow';

interface AppProps {
  config: WidgetConfig;
}

export const App: React.FC<AppProps> = ({ config }) => {
  const {
    messages,
    isTyping,
    isOpen,
    setIsOpen,
    startChat,
    handleButtonClick,
    handleTextSubmit,
    doctorName,
  } = useChat(config);

  const handleBubbleClick = () => {
    if (!isOpen) {
      startChat();
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <Bubble
        primaryColor={config.primaryColor}
        position={config.position}
        isOpen={isOpen}
        onClick={handleBubbleClick}
      />
      {isOpen && (
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
          doctorName={doctorName}
          config={config}
          onButtonClick={handleButtonClick}
          onTextSubmit={handleTextSubmit}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
