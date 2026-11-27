"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Message = { role: "user" | "assistant"; content: string; isStreaming?: boolean };

export default function ChatPage() {
  const { workspaceId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I am Insight. Ask me anything about your workspace." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !workspaceId || isLoading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "", isStreaming: true }]);

    try {
      const response = await fetch(`/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId, question: userMsg }),
      });

      if (!response.ok) throw new Error("Failed to get answer");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let currentText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          currentText += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            const lastMsg = newMessages[lastIndex];
            if (lastMsg && lastMsg.role === "assistant") {
              newMessages[lastIndex] = { ...lastMsg, content: currentText };
            }
            return newMessages;
          });
        }
      }

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === "assistant") {
          newMessages[lastIndex] = { ...lastMsg, isStreaming: false };
        }
        return newMessages;
      });
    } catch {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === "assistant") {
          newMessages[lastIndex] = {
            ...lastMsg,
            content: "Sorry, I could not reach the server. Please try again later.",
            isStreaming: false,
          };
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }

  function renderContent(content: string) {
    const parts = content.split(/(\[task:[a-zA-Z0-9]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("[task:") && part.endsWith("]")) {
        return (
          <Badge
            key={i}
            variant="secondary"
            className="mx-1 cursor-pointer hover:bg-primary/20 transition-colors"
          >
            <Sparkles className="mr-1 h-3 w-3 text-primary" /> Cited Task
          </Badge>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col max-w-3xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Insight
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about your tasks and get cited answers.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border bg-card p-4 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Bot className="h-5 w-5" />
              </div>
            )}
            <div
              className={`rounded-xl px-4 py-2 text-sm max-w-[80%] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {renderContent(msg.content)}
              {msg.isStreaming && (
                <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What tasks are due this week?"
          className="flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={!input.trim() || isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
