import "server-only";

import { NextResponse } from "next/server";
import { EdgeTTS } from "edge-tts-universal";

// Microsoft Edge neural voice — free, no API key.
// Other options: en-US-AriaNeural (female), en-US-JennyNeural, en-GB-RyanNeural
const EDGE_VOICE = "en-US-GuyNeural";

function escapeForSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * POST returns audio bytes using Microsoft Edge TTS only (free, no API key).
 * Uses edge-tts-universal (updated auth/compat). ElevenLabs backup: see elevenlabs-tts.backup.ts and AUDIO.md.
 */
export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  const safeText = escapeForSsml(text);
  if (!safeText.trim()) {
    return NextResponse.json({ error: "text is empty after sanitization." }, { status: 400 });
  }

  try {
    const tts = new EdgeTTS(safeText, EDGE_VOICE);
    const result = await tts.synthesize();
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "TTS failed.";
    console.error("Edge TTS error:", e);
    return NextResponse.json(
      { error: message || "TTS failed." },
      { status: 500 },
    );
  }
}
