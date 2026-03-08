import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { setStreamToken } from "./store";

// Titan-style deep voice: Adam (Dominant, Firm).
const VOICE_ID = "pNInz6obpgDQGcFmaJgB";

/**
 * POST returns a stream URL so the client can play audio as it streams (low latency).
 * The client sets audio.src = streamUrl and plays; the GET stream endpoint pipes ElevenLabs.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  const token = randomUUID();
  setStreamToken(token, text);

  return NextResponse.json({
    streamUrl: `/api/audio/stream?t=${token}`,
  });
}
