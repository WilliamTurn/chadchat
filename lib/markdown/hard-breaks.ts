// biome-ignore lint/suspicious/noExplicitAny: minimal mdast node shapes
type MdNode = { type: string; value?: string; children?: any[] };

/**
 * Honor the author's line breaks: turn single-newline soft breaks into hard
 * <br>. Plans are pasted/generated documents where every line matters, but
 * Markdown collapses single newlines into spaces; without this, consecutive
 * lines like "Day 3 …\nDay 4 …" run together. Markdown (lists, headings, bold)
 * still renders normally; this only affects loose lines inside a paragraph.
 * Zero-dep remark plugin, shared by every plan/document renderer.
 */
export function remarkHardBreaks() {
  const walk = (node: MdNode) => {
    if (!node || !Array.isArray(node.children)) {
      return;
    }
    const next: MdNode[] = [];
    for (const child of node.children as MdNode[]) {
      if (
        child.type === "text" &&
        typeof child.value === "string" &&
        child.value.includes("\n")
      ) {
        const parts = child.value.split("\n");
        parts.forEach((part, i) => {
          if (part) {
            next.push({ type: "text", value: part });
          }
          if (i < parts.length - 1) {
            next.push({ type: "break" });
          }
        });
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return (tree: MdNode) => walk(tree);
}
