/**
 * Variante web de BridgeWebView : iframe `srcDoc` + postMessage.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

export interface BridgeHandle {
  run(script: string): void;
}

interface Props {
  html: string;
  onMessage(data: string): void;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  interactive?: boolean;
}

export const BridgeWebView = forwardRef<BridgeHandle, Props>(function BridgeWebView(
  { html, onMessage, style, backgroundColor, interactive = true },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useImperativeHandle(ref, () => ({
    run(script) {
      const win = frame.current?.contentWindow as (Window & { eval(code: string): unknown }) | null | undefined;
      try {
        win?.eval(script);
      } catch (error) {
        console.warn('BridgeWebView', error);
      }
    },
  }));

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && typeof event.data === 'string') handler.current(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  return (
    <iframe
      ref={frame}
      srcDoc={html}
      title="Contenu"
      style={{
        border: 'none',
        flex: 1,
        width: '100%',
        height: '100%',
        ...(flat as object),
        backgroundColor: backgroundColor ?? 'transparent',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  );
});
