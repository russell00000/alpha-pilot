import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, Lightbulb, TrendingUp, PieChart, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import financeBg from "@/assets/finance-bg.webp";

interface Message {
  role: "user" | "assistant";
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMessage] },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        // Handle rate limits and payment errors
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
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Finance background */}
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{ backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/70" />

      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col max-w-4xl relative">
        {/* Chat Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ textShadow: '0 1px 20px rgba(0,0,0,0.5)' }}>AI Chat</h1>
            <p className="text-muted-foreground">Your personal investing assistant</p>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 flex flex-col min-h-[500px] max-h-[calc(100vh-300px)]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-4 animate-fade-in",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <Bot className="w-5 h-5" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-5 py-4",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-md"
                      : "bg-secondary text-foreground rounded-tl-md"
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 animate-fade-in">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-md px-5 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Topics - Only show at start */}
          {messages.length === 1 && (
            <div className="px-6 pb-4">
              <p className="text-sm text-muted-foreground mb-3">Suggested topics:</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic.label}
                    onClick={() => sendMessage(topic.prompt)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                  >
                    <topic.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">{topic.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-border/50">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about stocks, markets, strategies... (Press Enter to send)"
                disabled={isLoading}
                className="flex-1 min-h-[52px] max-h-[200px] resize-none"
                rows={1}
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()} 
                variant="premium"
                size="lg"
                className="px-6"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
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
