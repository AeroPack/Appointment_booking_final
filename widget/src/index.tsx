import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import type { WidgetConfig } from './types';

function readConfig(): WidgetConfig | null {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    const scripts = document.querySelectorAll('script[data-widget-key]');
    const lastScript = scripts[scripts.length - 1] as HTMLScriptElement | null;
    if (!lastScript) return null;
    return parseScriptAttrs(lastScript);
  }
  return parseScriptAttrs(script);
}

function parseScriptAttrs(script: HTMLScriptElement): WidgetConfig {
  const widgetKey = script.getAttribute('data-widget-key') || '';
  const apiHost = script.getAttribute('data-api-host') || window.location.origin;
  const primaryColor = script.getAttribute('data-primary-color') || '#3b82f6';
  const greeting = script.getAttribute('data-greeting') || 'Hi! How can I help you today?';
  const position = (script.getAttribute('data-position') as 'bottom-right' | 'bottom-left') || 'bottom-right';

  return { widgetKey, apiHost, primaryColor, greeting, position };
}

function init() {
  const config = readConfig();
  if (!config || !config.widgetKey) {
    console.error('[Chatbot] data-widget-key attribute is required');
    return;
  }

  const container = document.createElement('div');
  container.id = `chatbot-${config.widgetKey}`;
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
