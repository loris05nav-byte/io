import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { tesseractHtml } from '../../services/ocr/tesseractHtml';
import { BridgeHandle, BridgeWebView } from '../BridgeWebView';

export interface TesseractHandle {
  /**
   * Reconnaît le texte d'une image.
   * @param image image encodée en « data URL » (data:image/jpeg;base64,…)
   * @param language codes Tesseract (ex. « fra+eng »)
   */
  recognize(image: string, language: string, onProgress?: (progress: number, status: string) => void): Promise<string>;
}

interface Job {
  resolve(text: string): void;
  reject(error: Error): void;
  onProgress?: (progress: number, status: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

type EngineMessage =
  | { type: 'ready' }
  | { type: 'progress'; id: string; status: string; progress: number }
  | { type: 'result'; id: string; text: string }
  | { type: 'error'; id: string; message: string };

const TIMEOUT_MS = 180_000;

/**
 * Moteur OCR de secours : Tesseract.js dans une WebView invisible.
 * À monter dans l'écran qui en a besoin ; s'utilise via sa référence.
 */
export const TesseractEngine = forwardRef<TesseractHandle>(function TesseractEngine(_props, ref) {
  const bridge = useRef<BridgeHandle>(null);
  const ready = useRef(false);
  const queue = useRef<string[]>([]);
  const jobs = useRef(new Map<string, Job>());
  const counter = useRef(0);

  const finish = useCallback((id: string): Job | undefined => {
    const job = jobs.current.get(id);
    if (job) {
      clearTimeout(job.timer);
      jobs.current.delete(id);
    }
    return job;
  }, []);

  useImperativeHandle(ref, () => ({
    recognize(image, language, onProgress) {
      return new Promise<string>((resolve, reject) => {
        const id = `job${++counter.current}`;
        const timer = setTimeout(() => {
          finish(id)?.reject(new Error('La reconnaissance a pris trop de temps.'));
        }, TIMEOUT_MS);
        jobs.current.set(id, { resolve, reject, onProgress, timer });
        const script = `window.OcrEngine.recognize(${JSON.stringify(id)}, ${JSON.stringify(image)}, ${JSON.stringify(language)});`;
        if (ready.current) bridge.current?.run(script);
        else queue.current.push(script);
      });
    },
  }));

  const onMessage = useCallback(
    (data: string) => {
      let message: EngineMessage;
      try {
        message = JSON.parse(data) as EngineMessage;
      } catch {
        return;
      }
      if (message.type === 'ready') {
        ready.current = true;
        queue.current.splice(0).forEach((script) => bridge.current?.run(script));
      } else if (message.type === 'progress') {
        jobs.current.get(message.id)?.onProgress?.(message.progress, message.status);
      } else if (message.type === 'result') {
        finish(message.id)?.resolve(message.text);
      } else if (message.type === 'error') {
        const offline = message.message === 'NETWORK' || /fetch|network|load/i.test(message.message);
        finish(message.id)?.reject(
          new Error(offline ? 'Connexion Internet requise pour télécharger le moteur de reconnaissance.' : 'La reconnaissance du texte a échoué.'),
        );
      }
    },
    [finish],
  );

  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <BridgeWebView ref={bridge} html={tesseractHtml} onMessage={onMessage} interactive={false} />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, opacity: 0, left: -10, top: -10 },
});
