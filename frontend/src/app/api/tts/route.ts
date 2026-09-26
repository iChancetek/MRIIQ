import { NextResponse } from "next/server";

export async function GET(req: Request) {
  return handleTts(req, null);
}

export async function POST(req: Request) {
  let bodyJson: Record<string, unknown> | null = null;
  try {
    bodyJson = await req.json();
  } catch {
    // body might be empty or query params used
  }
  return handleTts(req, bodyJson);
}

async function handleTts(req: Request, body: Record<string, unknown> | null) {
  try {
    const url = new URL(req.url);
    const queryText = url.searchParams.get("text");
    const recommendation = (body?.recommendation as string) || url.searchParams.get("recommendation") || "APPROVE";
    const bodyDenials = Array.isArray(body?.denial_reasons) ? (body?.denial_reasons as string[]) : [];
    const queryDenials = url.searchParams.getAll("denial_reasons");
    const denialReasons = bodyDenials.length > 0 ? bodyDenials : queryDenials;

    let script = "";
    if (body?.text && typeof body.text === "string") {
      script = body.text;
    } else if (queryText) {
      script = queryText;
    } else {
      script = `The prior authorization recommendation is ${recommendation}.`;
      if (denialReasons.length > 0) {
        script += ` Reasons for denial include: ${denialReasons.join(". ")}.`;
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_TTS_MODEL || "tts-1-hd";
    const voice = process.env.OPENAI_TTS_VOICE || "onyx";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OpenAI API key not configured for server-side TTS. Use client-side Web Speech fallback.",
          fallback_available: true,
        },
        { status: 503 },
      );
    }

    // Call OpenAI TTS
    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        voice: voice,
        input: script.slice(0, 4096),
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return NextResponse.json(
        { error: `OpenAI TTS Error: ${errText}` },
        { status: openaiRes.status },
      );
    }

    const audioBuffer = await openaiRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "TTS Generation Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
