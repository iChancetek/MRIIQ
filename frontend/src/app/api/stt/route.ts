import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured for Whisper Speech-to-Text." },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") || formData.get("file");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided in request (expected 'audio' or 'file')." },
        { status: 400 }
      );
    }

    // Prepare outbound FormData for OpenAI Whisper
    const outboundFormData = new FormData();
    const fileName = (audioFile as File).name || "recording.webm";
    outboundFormData.append("file", audioFile, fileName);
    outboundFormData.append("model", "whisper-1");
    outboundFormData.append("language", "en");
    outboundFormData.append(
      "prompt",
      "Physician clinical documentation, SOAP notes, Lumbar Spine MRI, CPT 72148, radiculopathy, Straight Leg Raise test, SLR, conservative physical therapy, ICD-10 M54.16, Prior Authorization."
    );

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: outboundFormData,
    });

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text();
      return NextResponse.json(
        { error: `OpenAI Whisper STT error (${whisperResponse.status}): ${errText}` },
        { status: whisperResponse.status }
      );
    }

    const result = await whisperResponse.json();
    return NextResponse.json({
      text: result.text || "",
      model: "whisper-1",
      duration: result.duration,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "STT transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
