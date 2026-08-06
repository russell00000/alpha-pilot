import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ForecastChart, type ForecastData } from "./ForecastChart";

interface Message {
  role: "user" | "assistant";
  content: string;
  forecasts?: ForecastData[];
  isError?: boolean;
}

const suggestedPrompts = [
  "What stocks should I look at?",
  "Explain dollar-cost averaging",
  "Analyze AAPL performance",
  "Best ETFs for beginners?",
];

interface AIChatProps {
  onResetSize?: () => void;
}

const AIChat = ({ onResetSize }: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I'm your Vantage Copilot. What's on your mind today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasInteracted) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, hasInteracted]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    setHasInteracted(true);
    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Only send clean (non-error) history to the model so prior failed
      // turns don't poison the response.
      const history = [...messages, userMessage]
        .filter((m) => !m.isError)
        .map(({ role, content }) => ({ role, content }));
      const response = await supabase.functions.invoke("ai-chat", {
        body: { messages: history },
      });

      if (response.error) throw new Error(response.error.message);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.response,
          forecasts: response.data.forecasts ?? [],
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again.", isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (input.trim()) sendMessage(input);
  };

  return (
    <div ref={containerRef} className="group/chat relative rounded-3xl border border-foreground/10 bg-foreground/[0.03] backdrop-blur-2xl shadow-xl shadow-black/[0.06] flex flex-col resize-y overflow-hidden h-[640px] min-h-[420px] max-h-[1200px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-foreground/[0.08]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-black/10">
          <Sparkles className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">AI Copilot</p>
          <p className="text-[10px] text-success uppercase tracking-[0.2em] font-semibold flex items-center gap-1.5 mt-0.5">
            <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
            Online
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-hide">
        {messages.map((message, index) => (
          <div key={index} className={cn("flex gap-2.5 animate-fade-in", message.role === "user" ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border",
              message.role === "user" ? "bg-primary text-primary-foreground border-primary/20" : "bg-foreground/[0.06] text-foreground border-foreground/10"
            )}>
              {message.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={cn(
              "rounded-2xl px-3 py-2 border",
              message.role === "user"
                ? "max-w-[92%] bg-primary text-primary-foreground rounded-tr-sm border-primary/20"
                : message.forecasts && message.forecasts.length > 0
                  ? "w-full bg-foreground/[0.04] text-foreground rounded-tl-sm border-foreground/[0.06]"
                  : "max-w-[92%] bg-foreground/[0.04] text-foreground rounded-tl-sm border-foreground/[0.06]"
            )}>
              <p className="text-sm leading-snug whitespace-pre-line">{message.content}</p>
              {message.forecasts && message.forecasts.length > 0 && (
                <div className="space-y-3 mt-3">
                  {message.forecasts.map((f) => (
                    <ForecastChart key={f.symbol} forecast={f} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-foreground/[0.06] border border-foreground/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-foreground" />
            </div>
            <div className="bg-foreground/[0.04] border border-foreground/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      {messages.length === 1 && (
        <div className="px-5 pb-3 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Suggested Prompts</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.08] border border-foreground/[0.08] hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-foreground/[0.08]">
        <div className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={isLoading}
            className="flex-1 h-11 pr-12 text-sm bg-foreground/[0.04] border-foreground/10 rounded-xl focus:border-foreground/30 focus:bg-foreground/[0.08] placeholder:text-muted-foreground/60 transition-all"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 h-8 w-8 p-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-black/10 disabled:bg-muted disabled:text-foreground/40 disabled:shadow-none"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Button>
        </div>
        {onResetSize && (
          <button
            type="button"
            onClick={() => {
              onResetSize();
              if (containerRef.current) {
                containerRef.current.style.height = "640px";
              }
            }}
            className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors w-full"
          >
            <RotateCcw className="w-3 h-3" />
            Reset sizing
          </button>
        )}
      </form>
      {/* Resize hint */}
      <div className="pointer-events-none absolute bottom-1 right-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40 opacity-0 group-hover/chat:opacity-100 transition-opacity">
        drag to resize
      </div>
    </div>
  );
};

export default AIChat;
