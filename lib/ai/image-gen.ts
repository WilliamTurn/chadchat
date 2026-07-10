import "server-only";

/**
 * Runtime image generation for Future You (FEAT-29): OpenAI's images/edits
 * endpoint with the member's own photos passed as identity references.
 * gpt-image-2 processes every input image at high fidelity automatically (no
 * input_fidelity knob, the API rejects it for this model), which is exactly
 * the behavior the feature depends on: same face, same person, changed
 * physique.
 *
 * This is the app's ONLY runtime image generator. It talks to OpenAI directly
 * (the AI Gateway serves our text/vision models; image editing goes straight
 * to the source, same as the offline scripts/gen-image.mjs pipeline) and needs
 * OPENAI_API_KEY set in the environment.
 */

const IMAGES_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";

/** Portrait output, the right frame for a full-body physique photo. */
export const PORTRAIT_SIZE = "1024x1536";

// One edit call can take several minutes at high quality with multiple
// reference images (observed: 4+ min). Abort under the 800s function ceiling
// (app/future-you/page.tsx maxDuration) so a hung call fails the run instead
// of killing the invocation.
const EDIT_TIMEOUT_MS = 420_000;

function mediaTypeFor(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : "image/jpeg";
}

/**
 * Generate one photorealistic edit from the member's reference photos.
 * Returns the PNG bytes; the caller stores them (Vercel Blob) and never
 * exposes this layer to the client.
 */
export async function editImageFromReferences({
  prompt,
  referenceUrls,
  size = PORTRAIT_SIZE,
}: {
  prompt: string;
  referenceUrls: string[];
  size?: string;
}): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set, Future You image generation is unconfigured."
    );
  }

  const form = new FormData();
  form.append("model", process.env.IMG_MODEL ?? "gpt-image-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", "high");
  form.append("n", "1");

  // The member's photos, fetched from Blob and attached as the reference set.
  await Promise.all(
    referenceUrls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch reference photo ${i + 1} (${res.status})`
        );
      }
      const bytes = await res.arrayBuffer();
      form.append(
        "image[]",
        new Blob([bytes], { type: mediaTypeFor(url) }),
        `reference-${i + 1}.${mediaTypeFor(url) === "image/png" ? "png" : "jpg"}`
      );
    })
  );

  const response = await fetch(IMAGES_EDITS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(EDIT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `images/edits failed (${response.status}): ${detail.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as {
    data?: { b64_json?: string }[];
  };
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("images/edits returned no image data");
  }
  return Buffer.from(b64, "base64");
}
