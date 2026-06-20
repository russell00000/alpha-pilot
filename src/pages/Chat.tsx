import { useState, useRef, useEffect, lazy, Suspense } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Lightbulb,
  TrendingUp,
  PieChart,
  DollarSign,
  Copy,
  Check,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import financeBg from "@/assets/finance-bg.webp";

const ForecastChart = lazy(() =>
  import("@/components/ForecastChart").then((m) => ({ default: m.ForecastChart })),
);

type ForecastData = Parameters<
  typeof import("@/components/ForecastChart").ForecastChart
>[0]["data"];

interface Message {
  role: "user" | "assistant";
  content: string;
  forecasts?: ForecastData[];
  isError?: boolean;
}

const suggestedTopics = [
  { icon: TrendingUp, label: "Market Analysis", prompt: "What are the key market trends I should watch today?" },
  { icon: PieChart, label: "Portfolio Strategy", prompt: "How should I diversify my portfolio as a beginner investor?" },
  { icon: DollarSign, label: "Investment Basics", prompt: "Explain the difference between stocks, ETFs, and mutual funds" },
  { icon: Lightbulb, label: "Stock Research", prompt: "What metrics should I look at when evaluating a stock?" },
];

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to InvestAI Chat! 👋\n\nI'm your AI investing copilot, here to help you navigate the markets. I can help you with:\n\n• **Market Analysis** - Understanding trends and movements\n• **Stock Research** - Evaluating companies and investments\n• **Portfolio Strategy** - Building a diversified portfolio\n• **Investment Education** - Learning key concepts\n\nWhat would you like to explore today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Scroll only inside the chat container (never the page).
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    abortRef.current = new AbortController();

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
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I hit a snag pulling that together. Mind trying again in a moment?",
          isError: true,
        },
      ]);
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

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Finance background */}
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{ backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/70" />

      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col max-w-4xl relative">
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
          {messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([messages[0]])}
              className="text-muted-foreground hover:text-foreground"
            >
              New chat
            </Button>
          )}
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
                        <Suspense
                          key={`${index}-${fIdx}`}
                          fallback={
                            <div className="h-64 rounded-xl bg-secondary/40 border border-border/40 animate-pulse" />
                          }
                        >
                          <ForecastChart data={forecast} />
                        </Suspense>
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
      </main>
    </div>
  );
};

export default Chat;
