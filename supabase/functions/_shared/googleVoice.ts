export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function envKeys(): {
  speech: string;
  gemini: string;
  tts: string;
} {
  const speech =
    Deno.env.get("GOOGLE_SPEECH_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_SPEECH_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_API_KEY")?.trim() ||
    "";
  const gemini =
    Deno.env.get("GOOGLE_GEMINI_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_AI_API_KEY")?.trim() ||
    Deno.env.get("GEMINI_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_API_KEY")?.trim() ||
    "";
  const tts =
    Deno.env.get("GOOGLE_TTS_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_CLOUD_API_KEY")?.trim() ||
    Deno.env.get("GCP_API_KEY")?.trim() ||
    "";
  return { speech, gemini, tts };
}

export async function speechRecognize(
  apiKey: string,
  audioBase64: string,
  languageCode: string,
  sampleRateHertz: number,
): Promise<string> {
  const url =
    `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "LINEAR16",
        sampleRateHertz,
        languageCode,
        enableAutomaticPunctuation: true,
      },
      audio: { content: audioBase64 },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Speech-to-Text failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text) as {
    results?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
  };
  const first = data.results?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  return first;
}

export async function geminiGenerate(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userText: string;
}): Promise<string> {
  const { apiKey, model, systemInstruction, userText } = params;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  const parts = data.candidates?.[0]?.content?.parts;
  const out = parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
  if (!out) {
    const reason = data.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Gemini returned no text (finishReason=${reason})`);
  }
  return out;
}

/** Remove *stage directions* / emotes before TTS (watch should not speak them). */
export function stripAsteriskEmotes(text: string): string {
  let s = text;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/\*[^*\n]{1,160}\*/g, " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

export async function ttsMp3Base64(
  apiKey: string,
  text: string,
): Promise<string> {
  const spoken = stripAsteriskEmotes(text);
  if (!spoken) {
    throw new Error("Text-to-Speech: no speakable text after stripping stage directions.");
  }
  const url =
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: spoken },
      voice: {
        languageCode: Deno.env.get("MYNAH_TTS_LANGUAGE_CODE")?.trim() || "en-GB",
        name: Deno.env.get("MYNAH_TTS_VOICE_NAME")?.trim() || "en-GB-Neural2-A",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0,
      },
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Text-to-Speech failed: ${res.status} ${raw}`);
  }
  const data = JSON.parse(raw) as { audioContent?: string };
  const b64 = data.audioContent?.trim() ?? "";
  if (!b64) throw new Error("Text-to-Speech returned empty audio.");
  return b64;
}
