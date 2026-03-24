import { useState, useCallback, useRef, useEffect } from "react";
import type { TargetLanguage } from "@/lib/languages";
import { LANGUAGES } from "@/lib/languages";

interface UseTTSOptions {
  language: TargetLanguage;
  defaultRate?: number;
}

export function useTTS({ language, defaultRate = 0.8 }: UseTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rate, setRate] = useState(defaultRate);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const langConfig = LANGUAGES[language] || LANGUAGES.spanish;

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      setVoices(available);
    };

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Pick the best voice for the target language
  const getBestVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const speechLang = langConfig.speechLang; // e.g. "es-ES"
    const langPrefix = speechLang.split("-")[0]; // e.g. "es"

    // Prefer exact match
    const exact = voices.find((v) => v.lang === speechLang);
    if (exact) return exact;

    // Fallback to same language prefix
    return voices.find((v) => v.lang.startsWith(langPrefix));
  }, [voices, langConfig.speechLang]);

  const speak = useCallback(
    (text: string, overrideRate?: number) => {
      if (!("speechSynthesis" in window) || !text) return;

      // Cancel any current speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langConfig.speechLang;
      utterance.rate = overrideRate ?? rate;

      const voice = getBestVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    },
    [langConfig.speechLang, rate, getBestVoice]
  );

  const speakSlow = useCallback(
    (text: string) => speak(text, 0.5),
    [speak]
  );

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleRate = useCallback(() => {
    setRate((prev) => (prev <= 0.5 ? 0.8 : 0.5));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => speechSynthesis.cancel();
  }, []);

  return { speak, speakSlow, stop, isSpeaking, rate, toggleRate, isSupported: "speechSynthesis" in window };
}
