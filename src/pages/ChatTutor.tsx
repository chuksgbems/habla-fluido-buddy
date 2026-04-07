import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Send, Sparkles, MessageCircle, RefreshCw, Lightbulb, CheckCircle2, Bot, User, History
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const topics = [
  { value: "general", label: "General Conversation" },
  { value: "travel", label: "Travel & Directions" },
  { value: "food", label: "Food & Restaurant" },
  { value: "introductions", label: "Introductions" },
  { value: "shopping", label: "Shopping" },
  { value: "daily", label: "Daily Routine" },
];

export default function ChatTutor() {
  const [mode, setMode] = useState<"coach" | "free">("coach");
  const [topic, setTopic] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<{ id: string; topic: string | null; mode: string | null; created_at: string | null }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { currentLanguage, languageConfig: lang } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load past sessions for authenticated users
  useEffect(() => {
    if (!user) {
      setPastSessions([]);
      return;
    }
    const loadSessions = async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, topic, mode, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setPastSessions(data);
    };
    loadSessions();
  }, [user]);

  const createGreeting = useCallback((): Message => ({
    id: "welcome",
    role: "assistant",
    content: mode === "coach"
      ? `${lang.greeting} I'm your ${lang.label} coach. Let's practice together! Write something in ${lang.label}, and I'll help you improve. Don't worry about mistakes — that's how we learn!`
      : `${lang.greeting} Let's have a conversation in ${lang.label}. I'll only correct you if you ask. What would you like to talk about?`,
  }), [mode, lang]);

  // Start a new chat session
  const startNewChat = useCallback(async () => {
    setMessages([createGreeting()]);
    setSessionId(null);

    if (user) {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, topic, mode })
        .select("id")
        .single();

      if (!error && data) {
        setSessionId(data.id);
        // Save greeting message
        await supabase.from("chat_messages").insert({
          session_id: data.id,
          role: "assistant",
          content: createGreeting().content,
        });
      }
    }
  }, [user, topic, mode, createGreeting]);

  // Initialize on mode/language change
  useEffect(() => {
    startNewChat();
  }, [mode, lang.id]);

  // Load a past session
  const loadSession = async (id: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      setMessages(data.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
      setSessionId(id);

      // Restore mode/topic from session
      const session = pastSessions.find((s) => s.id === id);
      if (session?.mode) setMode(session.mode as "coach" | "free");
      if (session?.topic) setTopic(session.topic);
    }
    setShowHistory(false);
  };

  // Save a message to the database
  const saveMessage = async (role: string, content: string, currentSessionId: string) => {
    await supabase.from("chat_messages").insert({
      session_id: currentSessionId,
      role,
      content,
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Ensure we have a session for authenticated users
    let activeSessionId = sessionId;
    if (user && !activeSessionId) {
      const { data } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, topic, mode })
        .select("id")
        .single();
      if (data) {
        activeSessionId = data.id;
        setSessionId(data.id);
      }
    }

    // Save user message
    if (user && activeSessionId) {
      await saveMessage("user", input, activeSessionId);
    }

    try {
      const response = await supabase.functions.invoke("spanish-tutor", {
        body: {
          message: input,
          mode,
          topic,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          userLevel: profile?.level || "beginner",
          coachStyle: profile?.coach_style || "gentle",
          explainInEnglish: profile?.explain_in_english ?? true,
          targetLanguage: currentLanguage,
        },
      });

      if (response.error) throw response.error;

      const replyContent = response.data.reply || "Sorry, there was an error. Please try again.";
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: replyContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      if (user && activeSessionId) {
        await saveMessage("assistant", replyContent, activeSessionId);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: error.message || "Failed to send message.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{lang.label} Chat Tutor</h1>
          <p className="text-muted-foreground">Practice {lang.label} in real conversations</p>
        </div>
        {user && pastSessions.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-2">
            <History className="h-4 w-4" />
            Past Chats
          </Button>
        )}
      </div>

      {/* Past Sessions Panel */}
      {showHistory && (
        <Card className="mb-4 border shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Recent Conversations</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pastSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors ${
                    sessionId === s.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <span className="font-medium capitalize">{s.mode || "chat"}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="capitalize">{s.topic || "general"}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{formatDate(s.created_at)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as "coach" | "free")}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="coach" className="gap-2"><Sparkles className="h-4 w-4" />Coach Mode</TabsTrigger>
            <TabsTrigger value="free" className="gap-2"><MessageCircle className="h-4 w-4" />Free Chat</TabsTrigger>
          </TabsList>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select topic" /></SelectTrigger>
            <SelectContent>
              {topics.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="coach" className="mt-0">
          <Badge variant="secondary" className="mb-4">I'll correct your {lang.label} and explain grammar</Badge>
        </TabsContent>
        <TabsContent value="free" className="mt-0">
          <Badge variant="secondary" className="mb-4">Natural conversation — corrections only when you ask</Badge>
        </TabsContent>
      </Tabs>

      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {lang.flag} Language Buddy
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={startNewChat} className="gap-2">
              <RefreshCw className="h-4 w-4" />New Chat
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><Bot className="h-4 w-4" /></div>
                  <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2 p-4 pt-0">
            <Button variant="outline" size="sm" onClick={() => setInput("Can you correct my last message?")} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />Correct me
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInput("Give me a hint for what to say next")} className="gap-2">
              <Lightbulb className="h-4 w-4" />Give hint
            </Button>
          </div>

          <div className="border-t p-4">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Type in ${lang.label} or English...`} disabled={isLoading} className="flex-1" />
              <Button type="submit" disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {!user && (
        <p className="mt-4 text-center text-sm text-muted-foreground">Sign in to save your chat history and track progress</p>
      )}
    </div>
  );
}
