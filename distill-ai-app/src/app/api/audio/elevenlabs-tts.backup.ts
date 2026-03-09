/**
 * BACKUP: ElevenLabs TTS — not used by default.
 * To use: set AUDIO_TTS_PROVIDER=elevenlabs and ELEVENLABS_API_KEY,
 * then in route.ts add: if (process.env.AUDIO_TTS_PROVIDER === "elevenlabs") return synthesizeElevenLabs(...)
 */
import { NextResponse } from "next/server";

const ELEVENLABS_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam — Titan-style deep voice

export async function synthesizeElevenLabs(apiKey: string, text: string): Promise<NextResponse> {
  const streamUrl = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
  );
  streamUrl.searchParams.set("optimize_streaming_latency", "3");
  streamUrl.searchParams.set("output_format", "mp3_22050_32");

  const response = await fetch(streamUrl.toString(), {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return NextResponse.json(
      { error: `ElevenLabs error: ${body}` },
      { status: response.status },
    );
  }

  const stream = response.body;
  if (!stream) {
    return NextResponse.json({ error: "No stream from ElevenLabs." }, { status: 502 });
  }

  return new NextResponse(stream, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
