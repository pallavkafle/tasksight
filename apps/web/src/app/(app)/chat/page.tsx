"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I am Insight. Ask me anything about your workspace." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: 'The RAG API is not connected yet, but I heard you say: "' + userMsg + '"',
        },
      ]);
    }, 1000);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col max-w-3xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Ask Sathi</h1>
        <p className="text-sm text-muted-foreground">Your AI workspace assistant.</p>
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
              className={`rounded-xl px-4 py-2 text-sm max-w-[80%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
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
          placeholder="Ask about your tasks..."
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
