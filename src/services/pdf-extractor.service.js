import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Service Ekstraksi PDF Cepat & Presisi Per Halaman (Powered by Mozilla pdfjs-dist)
 * Mengekstrak seluruh teks dokumen dengan segmentasi per halaman (page 1..N)
 * Kecepatan tinggi (~150-300ms) tanpa dependensi Python atau model berat.
 */

/**
 * Ekstrak naskah PDF dari file path lokal
 * @param {string} filePath - Path absolut atau relatif ke file PDF
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNumber: number, text: string, paragraphs: string[] }>, fullText: string }>}
 */
export async function extractPdfPages(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File PDF tidak ditemukan di path: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(dataBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages = [];
  const fullTextParts = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const textItems = textContent.items || [];
    let pageText = "";
    let currentLine = "";
    let lastY = null;
    const paragraphs = [];

    for (const item of textItems) {
      if (!item.str) continue;

      const str = item.str;
      const y = item.transform ? item.transform[5] : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
        // Baris baru
        pageText += currentLine.trim() + "\n";
        if (currentLine.trim().length > 0) {
          paragraphs.push(currentLine.trim());
        }
        currentLine = str + " ";
      } else {
        currentLine += str + " ";
      }
      lastY = y;
    }

    if (currentLine.trim().length > 0) {
      pageText += currentLine.trim() + "\n";
      paragraphs.push(currentLine.trim());
    }

    const cleanPageText = pageText
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim();

    pages.push({
      pageNumber: pageNum,
      text: cleanPageText,
      paragraphs: paragraphs.filter((p) => p.length > 20),
    });

    fullTextParts.push(`--- HALAMAN ${pageNum} ---\n${cleanPageText}`);
  }

  return {
    pageCount,
    pages,
    fullText: fullTextParts.join("\n\n"),
  };
}

/**
 * Cari nomor halaman di mana sebuah kutipan atau potongan kalimat ditemukan
 * @param {Array<{ pageNumber: number, text: string }>} pages
 * @param {string} quoteSubstring
 * @returns {{ pageNumber: number, matchedSnippet: string, similarity: number } | null}
 */
export function findPageForQuote(pages, quoteSubstring) {
  if (!quoteSubstring || !Array.isArray(pages) || pages.length === 0) return null;

  const cleanQuery = quoteSubstring.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  if (cleanQuery.length < 10) return null;

  // 1. Coba pencarian persis (exact substring)
  for (const page of pages) {
    const cleanText = page.text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ");
    if (cleanText.includes(cleanQuery)) {
      return { pageNumber: page.pageNumber, matchedSnippet: quoteSubstring, similarity: 1.0 };
    }
  }

  // 2. Coba pencarian berbasis token / potongan 15 kata
  const words = cleanQuery.split(" ");
  const chunkWords = words.slice(0, Math.min(words.length, 12)).join(" ");

  for (const page of pages) {
    const cleanText = page.text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ");
    if (cleanText.includes(chunkWords)) {
      return { pageNumber: page.pageNumber, matchedSnippet: chunkWords, similarity: 0.85 };
    }
  }

  return null;
}
