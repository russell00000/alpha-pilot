import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  User,
  Sparkles,
  Lightbulb,
  TrendingUp,
  PieChart,
  DollarSign,
  Copy,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import financeBg from "@/assets/finance-bg.webp";
import { ForecastChart, type ForecastData } from "@/components/ForecastChart";

interface Message {
  role: "user" | "assistant";
  content: string;
  forecasts?: ForecastData[];
  isError?: boolean;
}

interface ThreadRow {
  id: string;
  title: string;
  updated_at: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Welcome to InvestAI Chat! 👋\n\nI'm your AI investing copilot, here to help you navigate the markets. I can help you with:\n\n• **Market Analysis** - Understanding trends and movements\n• **Stock Research** - Evaluating companies and investments\n• **Portfolio Strategy** - Building a diversified portfolio\n• **Investment Education** - Learning key concepts\n\nWhat would you like to explore today?",
};

const suggestedTopics = [
  { icon: TrendingUp, label: "Market Analysis", prompt: "What are the key market trends I should watch today?" },
  { icon: PieChart, label: "Portfolio Strategy", prompt: "How should I diversify my portfolio as a beginner investor?" },
  { icon: DollarSign, label: "Investment Basics", prompt: "Explain the difference between stocks, ETFs, and mutual funds" },
  { icon: Lightbulb, label: "Stock Research", prompt: "What metrics should I look at when evaluating a stock?" },
];

const Chat = () => {
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId?: string }>();
  const { user, loading: authLoading } = useAuth();

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Voice conversation state
  const [voiceOn, setVoiceOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIndexRef = useRef<number>(-1);

  // Redirect unauthenticated users to /auth so persistence works.
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  // Load thread list for the signed-in user.
  const refreshThreads = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Load threads error:", error);
      return;
    }
    setThreads(data ?? []);
  }, [user]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  // If on /chat with no threadId, pick most recent or create a new thread.
  useEffect(() => {
    if (!user || threadId) return;
    let cancelled = false;
    (async () => {
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (existing && existing.length > 0) {
        navigate(`/chat/${existing[0].id}`, { replace: true });
        return;
      }
      const { data: created, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user.id, title: "New chat" })
        .select("id")
        .single();
      if (error || !created) {
        console.error("Create thread error:", error);
        return;
      }
      navigate(`/chat/${created.id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, threadId, navigate]);

  // Load messages whenever active thread changes.
  useEffect(() => {
    if (!user || !threadId) return;
    let cancelled = false;
    setLoadingThread(true);
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("role,content,forecasts,is_error,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("Load messages error:", error);
        setMessages([WELCOME]);
      } else if (!data || data.length === 0) {
        setMessages([WELCOME]);
      } else {
        setMessages(
          data.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            forecasts: (m.forecasts as unknown as ForecastData[] | null) ?? undefined,
            isError: m.is_error,
          })),
        );
      }
      setLoadingThread(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, threadId]);

  // Scroll only inside the chat container (never the page).
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const persistMessage = async (msg: Message) => {
    if (!user || !threadId) return;
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: user.id,
      role: msg.role,
      content: msg.content,
      forecasts: (msg.forecasts ?? null) as unknown as never,
      is_error: msg.isError ?? false,
    });
    if (error) console.error("Save message error:", error);
  };

  const touchThread = async (titleIfFirst: string | null) => {
    if (!user || !threadId) return;
    const patch: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (titleIfFirst) patch.title = titleIfFirst.slice(0, 60);
    const { error } = await supabase.from("chat_threads").update(patch).eq("id", threadId);
    if (error) console.error("Touch thread error:", error);
    refreshThreads();
  };

  const createNewThread = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: user.id, title: "New chat" })
      .select("id")
      .single();
    if (error || !data) {
      toast({ title: "Couldn't start a new chat", variant: "destructive" });
      return;
    }
    refreshThreads();
    navigate(`/chat/${data.id}`);
  };

  const deleteThread = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete chat", variant: "destructive" });
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === threadId) {
      if (remaining.length > 0) navigate(`/chat/${remaining[0].id}`, { replace: true });
      else navigate(`/chat`, { replace: true });
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !threadId) return;

    const userMessage: Message = { role: "user", content: messageText };
    const isFirstUserMsg = !messages.some((m) => m.role === "user");
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    abortRef.current = new AbortController();
    persistMessage(userMessage);
    touchThread(isFirstUserMsg ? messageText : null);

    try {
      // Send full history minus prior error messages.
      const history = messages
        .filter((m) => !m.isError)
        .map(({ role, content }) => ({ role, content }));
      const response = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...history, { role: "user", content: messageText }] },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        if (response.data.error.includes("Rate limit")) {
          toast({
            title: "Rate Limited",
            description: "Too many requests. Please wait a moment and try again.",
            variant: "destructive",
          });
        } else if (response.data.error.includes("Payment") || response.data.error.includes("usage limit")) {
          toast({
            title: "Usage Limit",
            description: "AI usage limit reached. Please try again later.",
            variant: "destructive",
          });
        }
        throw new Error(response.data.error);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: response.data.response,
        forecasts: response.data.forecasts ?? undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      persistMessage(assistantMessage);
      touchThread(null);
    } catch (error) {
      console.error("Chat error:", error);
      const errMsg: Message = {
        role: "assistant",
        content: "I hit a snag pulling that together. Mind trying again in a moment?",
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
      persistMessage(errMsg);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      /* ignore */
    }
  };

  // Strip markdown so TTS reads clean prose (no ** or bullets).
  const stripMarkdown = (md: string) =>
    md
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[*_#>]+/g, " ")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

  const stopSpeaking = useCallback(() => {
    const a = currentAudioRef.current;
    if (a) {
      a.pause();
      a.src = "";
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    stopSpeaking();
    try {
      setIsSpeaking(true);
      const { data, error } = await supabase.functions.invoke("voice-speak", {
        body: { text: clean, voice: "onyx" },
      });
      if (error) throw error;
      // Supabase invoke returns a Blob for non-JSON responses.
      const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  }, [stopSpeaking]);

  // Auto-speak new assistant messages when voice mode is on.
  useEffect(() => {
    if (!voiceOn || isLoading || loadingThread) return;
    const lastIdx = messages.length - 1;
    if (lastIdx <= 0) return;
    const last = messages[lastIdx];
    if (last.role !== "assistant" || last.isError) return;
    if (lastSpokenIndexRef.current >= lastIdx) return;
    lastSpokenIndexRef.current = lastIdx;
    speak(last.content);
  }, [messages, voiceOn, isLoading, loadingThread, speak]);

  // When switching threads, reset spoken tracker so we don't replay history.
  useEffect(() => {
    lastSpokenIndexRef.current = messages.length - 1;
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const toggleVoiceMode = () => {
    setVoiceOn((v) => {
      const next = !v;
      if (!next) stopSpeaking();
      // If turning on, don't replay past messages — mark them as already spoken.
      if (next) lastSpokenIndexRef.current = messages.length - 1;
      return next;
    });
  };

  const startRecording = async () => {
    if (isRecording || isLoading) return;
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      // Pick a mime type the browser actually supports.
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (blob.size < 1024) {
          toast({ title: "Recording too short", description: "Please try again." });
          return;
        }
        setIsTranscribing(true);
        try {
          const form = new FormData();
          const ext = (recorder.mimeType || "audio/webm").includes("mp4") ? "mp4" : "webm";
          form.append("audio", blob, `recording.${ext}`);
          const { data, error } = await supabase.functions.invoke("voice-transcribe", {
            body: form,
          });
          if (error) throw error;
          const text = (data as { text?: string })?.text?.trim();
          if (text) sendMessage(text);
          else toast({ title: "Couldn't hear that", description: "Please try again." });
        } catch (err) {
          console.error("Transcribe error:", err);
          toast({ title: "Transcription failed", variant: "destructive" });
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      toast({
        title: "Microphone unavailable",
        description: "Please allow microphone access to use voice chat.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Finance background */}
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{ backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/70" />

      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 flex gap-4 max-w-6xl relative">
        {/* Thread sidebar */}
        <aside className="hidden md:flex w-64 flex-col rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-3 max-h-[calc(100vh-120px)]">
          <Button
            onClick={createNewThread}
            variant="premium"
            size="sm"
            className="w-full mb-3 gap-2"
          >
            <Plus className="w-4 h-4" /> New chat
          </Button>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No conversations yet.</p>
            )}
            {threads.map((t) => {
              const active = t.id === threadId;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors",
                    active
                      ? "bg-primary/15 text-foreground border border-primary/30"
                      : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground border border-transparent",
                  )}
                  onClick={() => navigate(`/chat/${t.id}`)}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{t.title || "New chat"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col max-w-4xl">
        {/* Chat Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 relative">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" style={{ textShadow: '0 1px 20px rgba(0,0,0,0.5)' }}>
                Vantage Copilot
              </h1>
              <p className="text-sm text-muted-foreground">
                Live market data · Real-time analysis
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewThread}
            className="text-muted-foreground hover:text-foreground md:hidden gap-1"
          >
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 flex flex-col min-h-[500px] max-h-[calc(100vh-260px)] overflow-hidden">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3 animate-fade-in group",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>
                <div className={cn("flex flex-col gap-2 max-w-[85%]", message.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-md"
                        : message.isError
                          ? "bg-destructive/10 border border-destructive/30 text-foreground rounded-tl-md"
                          : "bg-secondary/80 text-foreground rounded-tl-md border border-border/40"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-code:text-primary prose-code:bg-background/50 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-a:text-primary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Forecast charts */}
                  {message.role === "assistant" && message.forecasts && message.forecasts.length > 0 && (
                    <div className="w-full space-y-3 mt-1">
                      {message.forecasts.map((forecast, fIdx) => (
                        <ForecastChart
                          key={`${index}-${fIdx}`}
                          forecast={forecast}
                        />
                      ))}
                    </div>
                  )}

                  {/* Copy button on assistant messages */}
                  {message.role === "assistant" && index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopy(message.content, index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3 h-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-secondary/80 border border-border/40 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span className="text-xs text-muted-foreground">Analyzing markets…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Topics - Only show at start */}
          {messages.length === 1 && (
            <div className="px-6 pb-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Try asking
              </p>
              <div className="grid grid-cols-2 gap-2">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => sendMessage(topic.prompt)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/40 hover:border-primary/40 transition-all text-left group"
                  >
                    <topic.icon className="w-4 h-4 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-foreground">{topic.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 bg-background/40">
            <div className="relative flex items-end gap-2 rounded-xl bg-secondary/40 border border-border/40 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all px-2 py-1.5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a stock, strategy, or market trend…"
                disabled={isLoading}
                className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-2 py-2"
                rows={1}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                variant="premium"
                size="icon"
                className="h-9 w-9 flex-shrink-0 rounded-lg"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
              <kbd className="px-1 py-0.5 rounded bg-secondary/60 border border-border/40 text-[10px]">Enter</kbd> to send ·{" "}
              <kbd className="px-1 py-0.5 rounded bg-secondary/60 border border-border/40 text-[10px]">Shift+Enter</kbd> for newline
            </p>
          </form>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          InvestAI provides educational information only. Not financial advice. Always do your own research.
        </p>
        </div>
      </main>
    </div>
  );
};

export default Chat;
