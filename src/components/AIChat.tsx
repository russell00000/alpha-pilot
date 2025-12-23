import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestedPrompts = [
  "What stocks should I look at today?",
  "Explain dollar-cost averaging",
  "Analyze AAPL's recent performance",
  "Best ETFs for beginners?",
];

const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I'm your AI investing copilot. Ask me about market trends, stock analysis, portfolio strategies, or any investing question you have. 📈",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          content: "Sorry, I encountered an error. Please try again.",
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

  return (
    <div className="glass-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-border/30">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">AI Copilot</h2>
          <p className="text-xs text-muted-foreground">Your personal investing assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3 animate-fade-in",
              message.role === "user" ? "flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                message.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                  : "bg-secondary border border-border/30 text-foreground"
              )}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                message.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-md"
                  : "bg-secondary/50 border border-border/30 text-foreground rounded-tl-md"
              )}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-secondary border border-border/30 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-secondary/50 border border-border/30 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length === 1 && (
        <div className="px-5 pb-3">
          <p className="text-xs text-muted-foreground mb-2.5">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-2 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/30 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-5 border-t border-border/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about stocks, markets, strategies..."
            disabled={isLoading}
            className="flex-1 bg-secondary/30 border-border/30 focus:border-primary/50 transition-colors duration-200"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="btn-hover-lift"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;