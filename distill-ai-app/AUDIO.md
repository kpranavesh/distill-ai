# Audio overview (TTS)

The “Listen to your briefing” feature uses **Microsoft Edge TTS only** (free, no API key). No ElevenLabs code runs unless you re-enable it.

## Re-enabling ElevenLabs later

1. **Backup file**: `src/app/api/audio/elevenlabs-tts.backup.ts` contains the full ElevenLabs implementation (voice ID, model, streaming).
2. In `src/app/api/audio/route.ts`:
   - Import: `import { synthesizeElevenLabs } from "./elevenlabs-tts.backup";`
   - At the start of `POST`, add:
     - `if (process.env.AUDIO_TTS_PROVIDER === "elevenlabs" && process.env.ELEVENLABS_API_KEY) { return synthesizeElevenLabs(process.env.ELEVENLABS_API_KEY, text); }`
   - Then run with `AUDIO_TTS_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY=sk_...` in `.env.local` or Vercel.

Until then, only Edge TTS is used.
