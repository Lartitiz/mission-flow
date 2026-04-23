import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export function useSpeechRecognition({ onResult }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [restartBlocked, setRestartBlocked] = useState(false);
  const [pausedByVisibility, setPausedByVisibility] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance>(null);
  const onResultRef = useRef(onResult);
  // True intent: the user wants to be listening, even if the browser temporarily stopped us.
  const shouldListenRef = useRef(false);
  // Track manual stops so onend doesn't auto-restart
  const manualStopRef = useRef(false);

  // Always keep the latest callback in the ref
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  const startInternal = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return false;

    // Don't try to start if tab is hidden — browser will reject or behave erratically
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      setPausedByVisibility(true);
      return false;
    }

    try {
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
          onResultRef.current(transcript);
        }
      };

      recognition.onerror = (event: { error?: string }) => {
        const err = event?.error;
        // Soft errors that just pause: try to resume later
        if (err === 'no-speech' || err === 'aborted' || err === 'network') {
          return;
        }
        // Hard errors: stop & inform UI
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          shouldListenRef.current = false;
          setRestartBlocked(true);
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // If we manually stopped, don't restart
        if (manualStopRef.current || !shouldListenRef.current) {
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          return;
        }
        // If tab is hidden, mark as paused and wait for visibility return
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          setPausedByVisibility(true);
          return;
        }
        // Auto-restart (browser stops after ~60s)
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch {
            // InvalidStateError — try a fresh instance
            recognitionRef.current = null;
            const ok = startInternal();
            if (!ok) {
              setRestartBlocked(true);
              setIsListening(false);
            }
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setPausedByVisibility(false);
      setRestartBlocked(false);
      return true;
    } catch {
      setRestartBlocked(true);
      return false;
    }
  }, []);

  const start = useCallback(() => {
    manualStopRef.current = false;
    shouldListenRef.current = true;
    startInternal();
  }, [startInternal]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    shouldListenRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    }
    setIsListening(false);
    setPausedByVisibility(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening || shouldListenRef.current) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Stop the current recognition cleanly, but keep the intent.
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        if (recognition) {
          try {
            recognition.stop();
          } catch {
            /* noop */
          }
        }
        if (shouldListenRef.current) {
          setPausedByVisibility(true);
        }
      } else if (document.visibilityState === 'visible') {
        if (shouldListenRef.current && !recognitionRef.current) {
          // Try to resume
          const ok = startInternal();
          if (!ok) {
            setRestartBlocked(true);
          } else {
            setPausedByVisibility(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [startInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      manualStopRef.current = true;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    pausedByVisibility,
    restartBlocked,
    toggle,
    start,
    stop,
  };
}
