/**
 * WebView « pont » : charge une page HTML locale et échange des messages avec elle.
 * (Variante web basée sur une iframe : voir BridgeWebView.web.tsx.)
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

// Le paramètre générique par défaut de WebView (`undefined`) rend ses props inutilisables : on le fixe.
type WebViewRef = WebView<object>;

export interface BridgeHandle {
  /** Exécute du JavaScript dans la page. */
  run(script: string): void;
}

interface Props {
  html: string;
  onMessage(data: string): void;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  /** Autorise le défilement et le clavier (éditeur) ; sinon la vue est inerte (moteur invisible). */
  interactive?: boolean;
}

export const BridgeWebView = forwardRef<BridgeHandle, Props>(function BridgeWebView(
  { html, onMessage, style, backgroundColor, interactive = true },
  ref,
) {
  const webview = useRef<WebViewRef>(null);

  useImperativeHandle(ref, () => ({
    run(script) {
      webview.current?.injectJavaScript(`${script}\ntrue;`);
    },
  }));

  return (
    <WebView<object>
      ref={webview}
      // Une origine HTTPS factice permet aux scripts de la page d'utiliser fetch, les Workers et WebAssembly.
      source={{ html, baseUrl: 'https://folio.local/' }}
      originWhitelist={['*']}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      // Les liens d'un document ne doivent pas remplacer l'éditeur.
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('https://folio.local')}
      javaScriptEnabled
      domStorageEnabled
      keyboardDisplayRequiresUserAction={false}
      hideKeyboardAccessoryView
      automaticallyAdjustContentInsets={false}
      overScrollMode="never"
      scrollEnabled={interactive}
      showsVerticalScrollIndicator={interactive}
      showsHorizontalScrollIndicator={false}
      setSupportMultipleWindows={false}
      textZoom={100}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[{ backgroundColor: backgroundColor ?? 'transparent' }, style]}
      containerStyle={{ backgroundColor: backgroundColor ?? 'transparent' }}
    />
  );
});
