import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import type { WidgetConfig } from './types';

function readConfig(): WidgetConfig | null {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    const scripts = document.querySelectorAll('script[data-doctor-id]');
    const lastScript = scripts[scripts.length - 1] as HTMLScriptElement | null;
    if (!lastScript) return null;
    return parseScriptAttrs(lastScript);
  }
  return parseScriptAttrs(script);
}

function parseScriptAttrs(script: HTMLScriptElement): WidgetConfig {
  const doctorId = script.getAttribute('data-doctor-id') || '';
  const apiHost = script.getAttribute('data-api-host') || window.location.origin;
  const botApiKey = script.getAttribute('data-bot-api-key') || '';
  const primaryColor = script.getAttribute('data-primary-color') || '#3b82f6';
  const greeting = script.getAttribute('data-greeting') || 'Hi! How can I help you today?';
  const position = (script.getAttribute('data-position') as 'bottom-right' | 'bottom-left') || 'bottom-right';

  return { doctorId, apiHost, botApiKey, primaryColor, greeting, position };
}

function init() {
  const config = readConfig();
  if (!config || !config.doctorId) {
    console.error('[Chatbot] data-doctor-id attribute is required');
    return;
  }

  const container = document.createElement('div');
  container.id = `chatbot-${config.doctorId}`;
  container.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    React.createElement(App, { config })
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
