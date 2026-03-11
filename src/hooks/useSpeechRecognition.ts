import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export function useSpeechRecognition({ onResult }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance>(null);
  const onResultRef = useRef(onResult);

  // Always keep the latest callback in the ref
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        // Use the ref to always call the latest callback
        onResultRef.current(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (browser stops after ~60s)
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.stop();
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  return { isListening, isSupported, toggle, start, stop };
}
