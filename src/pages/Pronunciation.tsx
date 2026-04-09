import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, RotateCcw, ChevronRight, CheckCircle2, AlertCircle, Gauge, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTTS } from "@/hooks/useTTS";
import { getLanguageConfig } from "@/lib/languages";
import { supabase } from "@/integrations/supabase/client";
import type { TargetLanguage } from "@/lib/languages";

interface SpeechRecognitionResult { transcript: string; confidence: number; }
interface SpeechRecognitionEvent { results: { [key: number]: { [key: number]: SpeechRecognitionResult } }; }
interface SpeechRecognitionErrorEvent { error: string; }
interface SpeechRecognitionInstance {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
}

interface PhraseItem { text: string; english: string; difficulty: "easy" | "medium" | "hard"; tips: string[]; }

const fallbackPhrases: Record<TargetLanguage, PhraseItem[]> = {
  spanish: [
    { text: "Hola, ¿cómo estás?", english: "Hello, how are you?", difficulty: "easy", tips: ["The 'h' is silent", "Stress on 'có' in 'cómo'"] },
    { text: "Mucho gusto", english: "Nice to meet you", difficulty: "easy", tips: ["'ch' sounds like English 'ch'", "The 'u' in 'gusto' is silent"] },
    { text: "Buenos días", english: "Good morning", difficulty: "easy", tips: ["Emphasize 'DÍ' syllable", "The 'ue' diphthong in 'buenos'"] },
    { text: "¿Dónde está el baño?", english: "Where is the bathroom?", difficulty: "medium", tips: ["Roll the 'r' slightly", "Stress on 'DÓN' and 'BA'"] },
    { text: "Me gustaría un café, por favor", english: "I would like a coffee, please", difficulty: "medium", tips: ["'gust-a-RÍ-a' has four syllables", "Soft 'd'"] },
    { text: "El perro corre rápido", english: "The dog runs fast", difficulty: "hard", tips: ["Strong rolled 'rr' in 'perro' and 'corre'", "Practice the trill!"] },
  ],
  english: [
    { text: "How are you doing today?", english: "How are you doing today?", difficulty: "easy", tips: ["Stress on 'do' in 'doing'", "Natural intonation rises at end"] },
    { text: "Nice to meet you", english: "Nice to meet you", difficulty: "easy", tips: ["Link 'nice' and 'to'", "'meet' rhymes with 'feet'"] },
    { text: "Could you help me, please?", english: "Could you help me, please?", difficulty: "easy", tips: ["'Could' sounds like 'cud'", "Polite rising intonation"] },
    { text: "I'd like to make a reservation", english: "I'd like to make a reservation", difficulty: "medium", tips: ["Contract 'I would' to 'I'd'", "Stress on 'res-er-VA-tion'"] },
    { text: "The weather is beautiful", english: "The weather is beautiful", difficulty: "medium", tips: ["'th' is a dental fricative", "'beautiful' has 3 syllables: BYOO-tih-ful"] },
    { text: "She thoroughly thought through the theory", english: "She thoroughly thought through the theory", difficulty: "hard", tips: ["Multiple 'th' sounds", "Practice the difference between voiced and unvoiced 'th'"] },
  ],
};

export default function Pronunciation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPracticed, setTotalPracticed] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const lang = getLanguageConfig(profile?.target_language || "spanish");
  const { speak, speakSlow, isSpeaking, rate, toggleRate } = useTTS({ language: lang.id, defaultRate: 0.7 });

  const fetchPhrases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-phrases", {
        body: {
          language: lang.id,
          userLevel: profile?.level || "beginner",
          phrasesCompleted: totalPracticed,
        },
      });

      if (error) throw error;

      if (Array.isArray(data?.phrases) && data.phrases.length > 0) {
        setPhrases(data.phrases);
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      console.error("AI phrase generation failed, using fallback:", err);
      setPhrases(fallbackPhrases[lang.id] || fallbackPhrases.spanish);
    } finally {
      setLoading(false);
      setCurrentIndex(0);
      setTranscript("");
      setScore(null);
      setFeedback([]);
      setAttempts(0);
    }
  };

  useEffect(() => {
    fetchPhrases();
  }, []);

  const currentPhrase = phrases[currentIndex];

  const startRecording = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({ title: "Not supported", description: "Speech recognition is not available. Try Chrome or Edge.", variant: "destructive" });
      return;
    }

    recognitionRef.current = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
    recognitionRef.current.lang = lang.speechLang;
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const result = event.results[0][0];
      setTranscript(result.transcript);
      evaluatePronunciation(result.transcript, result.confidence);
    };

    recognitionRef.current.onerror = (event) => {
      setIsRecording(false);
      if (event.error === "no-speech") {
        toast({ title: "No speech detected", description: "Please try speaking louder" });
      } else if (event.error === "not-allowed") {
        toast({ title: "Microphone access denied", description: "Please allow microphone access", variant: "destructive" });
      }
    };

    recognitionRef.current.onend = () => setIsRecording(false);
    recognitionRef.current.start();
    setIsRecording(true);
    setTranscript("");
    setScore(null);
    setFeedback([]);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); };

  const levenshtein = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  };

  const normalize = (text: string): string =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿¡.,!?'";\-:()]/g, "").replace(/\s+/g, " ").trim();

  const evaluatePronunciation = (spokenText: string, confidence: number) => {
    const target = normalize(currentPhrase.text);
    const spoken = normalize(spokenText);

    const maxLen = Math.max(target.length, spoken.length, 1);
    const charSimilarity = Math.max(0, 1 - levenshtein(target, spoken) / maxLen);

    const targetWords = target.split(" ");
    const spokenWords = spoken.split(" ");
    const feedbackItems: string[] = [];
    let wordMatches = 0;

    targetWords.forEach((word, i) => {
      if (spokenWords[i] && spokenWords[i] === word) wordMatches++;
      else if (spokenWords[i]) feedbackItems.push(`"${spokenWords[i]}" should be "${word}"`);
      else feedbackItems.push(`Missing word: "${word}"`);
    });

    if (spokenWords.length > targetWords.length) feedbackItems.push("Extra words detected at the end");

    const wordSimilarity = targetWords.length > 0 ? wordMatches / targetWords.length : 0;
    const sttConfidence = typeof confidence === "number" && confidence > 0 ? confidence : 0.5;
    const rawScore = (charSimilarity * 0.4) + (wordSimilarity * 0.3) + (sttConfidence * 0.3);
    const similarityScore = Math.round(Math.min(rawScore * 100, 100));
    const finalScore = charSimilarity < 0.3 ? Math.min(similarityScore, 30) : similarityScore;

    setScore(finalScore);
    setFeedback(feedbackItems.slice(0, 3));
    setAttempts((prev) => prev + 1);
    setTotalPracticed((prev) => prev + 1);

    if (finalScore >= 80) toast({ title: lang.congratsMessage, description: "Great pronunciation!" });
    else if (finalScore >= 50) toast({ title: "Good try!", description: "Keep practicing." });
    else toast({ title: "Needs work", description: "Listen to the phrase and try again." });
  };

  const nextPhrase = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all phrases — fetch new batch
      fetchPhrases();
      return;
    }
    setTranscript(""); setScore(null); setFeedback([]); setAttempts(0);
  };

  const resetPhrase = () => { setTranscript(""); setScore(null); setFeedback([]); };

  const getDifficultyColor = (d: string) => {
    if (d === "easy") return "bg-success/20 text-success-foreground border-success/30";
    if (d === "medium") return "bg-warning/20 text-warning-foreground border-warning/30";
    return "bg-destructive/20 text-destructive-foreground border-destructive/30";
  };

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Generating personalized phrases...</p>
        </div>
      </div>
    );
  }

  if (!currentPhrase) return null;

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{lang.flag} Pronunciation Lab</h1>
        <p className="text-muted-foreground">Practice speaking {lang.label} with instant feedback</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Progress value={((currentIndex + 1) / phrases.length) * 100} className="flex-1 h-2" />
        <Badge variant="secondary">{currentIndex + 1}/{phrases.length}</Badge>
        {totalPracticed > 0 && <Badge className="bg-primary/10 text-primary">{totalPracticed} practiced</Badge>}
        <Button variant="ghost" size="icon" onClick={fetchPhrases} title="Get new phrases"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Say this phrase:</CardTitle>
            <Badge className={getDifficultyColor(currentPhrase.difficulty)}>{currentPhrase.difficulty}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="font-display text-2xl md:text-3xl font-bold text-primary">{currentPhrase.text}</p>
            <p className="text-muted-foreground">{currentPhrase.english}</p>
            <div className="flex items-center gap-2 justify-center">
              <Button variant="ghost" size="sm" onClick={() => speak(currentPhrase.text)} className="gap-2" disabled={isSpeaking}>
                <Volume2 className={`h-4 w-4 ${isSpeaking ? "animate-pulse text-primary" : ""}`} />Listen
              </Button>
              <Button variant="ghost" size="sm" onClick={() => speakSlow(currentPhrase.text)} className="gap-2" disabled={isSpeaking}>
                <Gauge className="h-4 w-4" />Slow
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleRate} className="h-8 w-8 text-xs font-mono text-muted-foreground" title="Toggle default speed">
                {rate <= 0.5 ? "0.5×" : "0.7×"}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">💡 Pronunciation tips:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentPhrase.tips.map((tip, i) => (<li key={i}>• {tip}</li>))}
            </ul>
          </div>

          <div className="flex justify-center">
            <Button size="lg" className={`h-20 w-20 rounded-full transition-all ${isRecording ? "bg-destructive hover:bg-destructive/90 animate-pulse" : "bg-primary hover:bg-primary/90"}`} onClick={isRecording ? stopRecording : startRecording}>
              {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">{isRecording ? "Listening... Click to stop" : "Click to start recording"}</p>

          {transcript && (
            <div className="space-y-4 animate-slide-in-up">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">You said:</p>
                <p className="font-medium text-lg">{transcript}</p>
              </div>
              {score !== null && (
                <div className="text-center space-y-3">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${score >= 80 ? "bg-success/20 text-success-foreground" : score >= 50 ? "bg-warning/20 text-warning-foreground" : "bg-destructive/20 text-destructive-foreground"}`}>
                    {score >= 80 ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <span className="font-bold text-xl">{score}%</span><span>match</span>
                  </div>
                  {feedback.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Feedback:</p>
                      {feedback.map((item, i) => (<p key={i}>• {item}</p>))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button variant="outline" onClick={resetPhrase} className="flex-1 gap-2"><RotateCcw className="h-4 w-4" />Try Again</Button>
        <Button onClick={nextPhrase} className="flex-1 gap-2">
          {currentIndex < phrases.length - 1 ? "Next Phrase" : "New Set"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {attempts > 0 && <p className="text-center text-sm text-muted-foreground mt-4">Attempts on this phrase: {attempts}</p>}
    </div>
  );
}
