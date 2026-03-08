import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAndDeleteStreamToken } from "../store";

const VOICE_ID = "pNInz6obpgDQGcFmaJgB";

/**
 * GET streams ElevenLabs TTS so the browser can start playing as soon as chunks arrive.
 * Uses fast model + latency optimization for low time-to-first-byte.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const token = req.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const text = getAndDeleteStreamToken(token);
  if (!text) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 404 });
  }

  const streamUrl = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
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
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
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
    return NextResponse.json(
      { error: "No stream from ElevenLabs." },
      { status: 502 },
    );
  }

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
