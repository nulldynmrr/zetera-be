/**
 * Render Engine — Output Fleksibel Multi-Format (§4.4 Dokumen 020)
 * Menangani dispatching format layout khusus per sub-bab:
 * - PARAGRAPH (Paragraf mengalir piramida terbalik)
 * - ROADMAP (Heading BAB Kapital tebal + Paragraf narasi menjorok)
 * - NUMBERED_LIST / LIST (Kalimat pengantar + Butir bernomor)
 * - TABLE (Matriks komparatif terstruktur)
 */

/**
 * Format teks paragraf standar
 */
export function renderParagraph(text = "") {
  if (!text) return "";
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Format khusus ROADMAP (Sistematika Penulisan):
 * Heading BAB huruf kapital tebal + Narasi deskriptif menjorok
 */
export function renderRoadmap(text = "") {
  if (!text) return { intro: "", chapters: [] };

  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let intro = "";
  const chapters = [];

  let currentChapter = null;

  for (const line of rawLines) {
    // Deteksi heading bab seperti "BAB I", "BAB II", "BAB 1", atau "BAB I PENDAHULUAN"
    const babMatch = line.match(/^(BAB\s+[IVXLCDM\d]+[:\s\-\.]*.*?)(?:[\:\-]\s*|$)/i);

    if (babMatch && !line.toLowerCase().includes("berisikan") && !line.toLowerCase().includes("pada bab ini")) {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      currentChapter = {
        heading: line.toUpperCase(),
        body: "",
      };
    } else if (currentChapter) {
      currentChapter.body = currentChapter.body ? `${currentChapter.body} ${line}` : line;
    } else {
      intro = intro ? `${intro} ${line}` : line;
    }
  }

  if (currentChapter) {
    chapters.push(currentChapter);
  }

  return {
    intro: intro || "Sistematika penulisan skripsi ini disusun ke dalam beberapa bab sebagai berikut:",
    chapters,
    rawText: text,
  };
}

/**
 * Format LIST / NUMBERED_LIST:
 * Memisahkan kalimat pengantar dan butir bernomor
 */
export function renderList(text = "") {
  if (!text) return { intro: "", items: [] };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let intro = "";
  const items = [];

  for (const line of lines) {
    const itemMatch = line.match(/^(\d+[\.\)]|[-•*])\s*(.*)$/);
    if (itemMatch) {
      items.push(itemMatch[2].trim());
    } else if (items.length === 0) {
      intro = intro ? `${intro} ${line}` : line;
    } else {
      // Baris lanjutan dari butir sebelumnya
      if (items.length > 0) {
        items[items.length - 1] += ` ${line}`;
      }
    }
  }

  return {
    intro,
    items,
    rawText: text,
  };
}

/**
 * Dispatcher format output sub-bab
 */
export function renderSubchapterContent(formatStyle = "PARAGRAPH", text = "") {
  switch (formatStyle?.toUpperCase()) {
    case "ROADMAP":
      return renderRoadmap(text);
    case "LIST":
    case "NUMBERED_LIST":
      return renderList(text);
    case "PARAGRAPH":
    default:
      return renderParagraph(text);
  }
}

export {
  parseSubchapterBlocks,
  renderBlocksToDocx,
  renderBlocksToLatex,
  getImageDimensions,
} from "./block-parser.js";

