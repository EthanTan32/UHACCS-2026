// app/api/food-chat/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type FoodChatRequest = {
  systemPrompt?: string;
  messages?: ChatMessage[];
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    const body = (await req.json()) as FoodChatRequest;

    const systemPrompt = body.systemPrompt?.trim() ?? "";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const cleaned: ChatMessage[] = messages
      .filter((m): m is ChatMessage => {
        return (
          m !== null &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
        );
      })
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 8000),
      }))
      .filter((m) => m.content.length > 0);

    const response = await client.responses.create({
      model: "gpt-5",
      instructions: systemPrompt,
      input: cleaned,
    });

    return Response.json({
      reply: response.output_text ?? "",
    });
  } catch (err: unknown) {
    console.error(err);
    return new Response(
      err instanceof Error ? err.message : "Server error",
      { status: 500 }
    );
  }
}
