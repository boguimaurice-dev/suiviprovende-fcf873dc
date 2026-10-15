import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Voix féminine multilingue (Sarah)
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(1).max(1500) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) throw new Error("Voix naturelle non configurée");
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) throw new Error(`Voix indisponible [${res.status}]: ${await res.text()}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin) };
  });
