// Client-side file downloads for the Files page and the chat document viewer.

export function safeFileName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

/** Save a text document to disk (markdown for documents, CSV for sheets). */
export function downloadTextFile({
  filename,
  content,
  mime,
}: {
  filename: string;
  content: string;
  mime: string;
}) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Download a remote file (an uploaded photo's Blob URL) to disk. Falls back
 *  to opening it in a new tab if the cross-origin fetch is blocked. */
export async function downloadRemoteFile({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
