// app/chat/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";

type Role = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
  createdAt: number;
};

function uid() {
  // simple unique id
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const FOOD_COACH_SYSTEM_PROMPT = `
You are a helpful, practical food and nutrition coach.
Your job is to answer questions about food choices, macros, meal timing, hydration, and recovery
for active people (e.g., basketball, sprinting, weight training, general fitness).

Rules:
- Be clear and actionable; prefer bullet points and simple explanations.
- If the user asks for "best foods" after a sport, give: goals (recovery), macro targets, timing, and examples.
- Avoid moralizing ("good/bad foods"). Use "more/less optimal."
- If the question is medical or high risk (e.g., eating disorder, severe symptoms, allergies), recommend seeing a professional.
- Do not claim to diagnose conditions.
- Ask at most ONE follow-up question only if truly necessary; otherwise make reasonable assumptions.
- When you mention ranges (e.g., protein grams), give simple ranges and explain what changes them (body weight, intensity).
`.trim();

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "Ask me anything about food for performance and recovery — e.g. “What should I eat after basketball?” or “Why do I need carbs?”",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [dietPlan, setDietPlan] = useState<any>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  // Load user and chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoadingChat(false);
          return;
        }

        setUserId(user.id);

        // Fetch chat history from database
        const { data, error } = await supabase
          .from("chat")
          .select("history")
          .eq("id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "no rows found" - that's okay
          console.error("Error loading chat history:", error);
          setIsLoadingChat(false);
          return;
        }

        if (data && data.history && Array.isArray(data.history)) {
          setMessages(data.history);
        }

        // Fetch user's diet plan
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("plan")
          .eq("id", user.id)
          .single();

        if (planData && planData.plan) {
          setDietPlan(planData.plan);
        }
      } catch (e) {
        console.error("Failed to load chat history:", e);
      } finally {
        setIsLoadingChat(false);
      }
    };

    loadChatHistory();
  }, []);

  // Save chat history whenever messages change
  useEffect(() => {
    const saveChatHistory = async () => {
      if (!userId || messages.length === 0 || isLoadingChat) return;

      try {
        const { error } = await supabase.from("chat").upsert(
          {
            id: userId,
            history: messages,
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("Error saving chat history:", error);
        }
      } catch (e) {
        console.error("Failed to save chat history:", e);
      }
    };

    saveChatHistory();
  }, [messages, userId, isLoadingChat]);

  useEffect(() => {
    // scroll to bottom on new message
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setError(null);
    setIsSending(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    // optimistic update
    setMessages((prev) => [...prev, userMsg]);

    // placeholder assistant message while streaming/loading
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "…",
        createdAt: Date.now(),
      },
    ]);

    try {
      // Build enhanced system prompt with diet plan context
      let enhancedSystemPrompt = FOOD_COACH_SYSTEM_PROMPT;

      if (dietPlan) {
        enhancedSystemPrompt += `\n\nThe user has the following diet plan on file:\n${JSON.stringify(dietPlan, null, 2)}\n\nRefer to this plan when the user asks about their current diet, recommendations related to their plan, or wants modifications to it.`;
      }

      const res = await fetch("/api/food-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: enhancedSystemPrompt,
          messages: [
            // Only send chat history (minus the placeholder we just added).
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as { reply: string };
      const reply = (data.reply ?? "").trim();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: reply.length ? reply : "I didn’t get any text back — try again.",
              }
            : m
        )
      );
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Something went wrong.";
      setError(msg);

      // replace placeholder with error text
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: "⚠️ Error getting response." } : m))
      );
    } finally {
      setIsSending(false);
      // focus input again
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function clearChat() {
    setError(null);
    const newMessages = [
      {
        id: uid(),
        role: "assistant" as const,
        content:
          "Chat cleared. Ask me anything about food for performance and recovery.",
        createdAt: Date.now(),
      },
    ];
    setMessages(newMessages);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 0);

    // Delete chat history from database
    if (userId) {
      supabase.from("chat").delete().eq("id", userId).catch((e) => {
        console.error("Error clearing chat history:", e);
      });
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar />
      <div className="mx-auto flex max-w-3xl flex-col px-4 pb-6 pt-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Diet Coach</h1>
            <p className="mt-1 text-sm text-neutral-300">
              Ask questions like:{" "}
              <span className="text-neutral-200">
                “best foods after basketball” • “why carbs matter” • “pre-workout meal ideas”
              </span>
            </p>
          </div>

          <button
            onClick={clearChat}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 active:scale-[0.99]"
            type="button"
          >
            Clear
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Messages */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4"
          style={{ height: "70vh" }}
        >
          {isLoadingChat ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-400">Loading chat history...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your question… (Enter to send, Shift+Enter for a new line)"
              className="min-h-[52px] w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-600"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!canSend}
              className="h-[52px] shrink-0 rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>

          <div className="mt-2 text-xs text-neutral-400">
            Tip: try “I’m 175lb and played 90 minutes of pickup — what should I eat tonight?”
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-neutral-100 text-neutral-950"
            : "bg-neutral-800/80 text-neutral-100",
        ].join(" ")}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`mt-1 text-[10px] ${isUser ? "text-neutral-700" : "text-neutral-400"}`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
