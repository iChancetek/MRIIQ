import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const recommendation = url.searchParams.get("recommendation") || "APPROVE";
    const denialReasons = url.searchParams.getAll("denial_reasons");

    let script = `The prior authorization recommendation is ${recommendation}.`;
    if (denialReasons.length > 0) {
      script += ` Reasons for denial include: ${denialReasons.join(". ")}.`;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_TTS_MODEL || "tts-1-hd";
    const voice = process.env.OPENAI_TTS_VOICE || "onyx";

    if (!apiKey) {
      return new Response("OpenAI API key not configured for TTS", { status: 503 });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        voice: voice,
        input: script,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(`OpenAI TTS Error: ${errText}`, { status: openaiRes.status });
    }

    const audioBuffer = await openaiRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "TTS Generation Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
