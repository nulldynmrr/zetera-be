/**
 * Academic Text & Math Cleaner
 * Mengatasi artifact font encoding PDF seperti mathematical italic/bold symbols
 * (misalnya '푥' -> 'x', '푦' -> 'y', '푟' -> 'r', '푝' -> 'p')
 * serta membersihkan ligatur dan karakter kontrol.
 */

export function sanitizeAcademicText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // 1. Map BMP shift math alphanumeric artifact (\uD400 - \uD47F)
    .replace(/[\uD400-\uD47F]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 0xd400 && code <= 0xd419) return String.fromCharCode(65 + code - 0xd400); // A-Z Bold
      if (code >= 0xd41a && code <= 0xd433) return String.fromCharCode(97 + code - 0xd41a); // a-z Bold
      if (code >= 0xd434 && code <= 0xd44d) return String.fromCharCode(65 + code - 0xd434); // A-Z Italic
      if (code >= 0xd44e && code <= 0xd467) return String.fromCharCode(97 + code - 0xd44e); // a-z Italic
      return c;
    })
    // 2. Map SMP Mathematical Alphanumeric Symbols (U+1D400 to U+1D7FF)
    .replace(/[\uD835][\uDC00-\uDFFF]/gu, (c) => {
      try {
        return c.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      } catch (_) {
        return c;
      }
    })
    // 3. Normalisasi ligatur umum font akademis
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/\uFB05/g, "ft")
    .replace(/\uFB06/g, "st")
    // 4. Bersihkan non-printable control characters (kecuali \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // 5. Normalisasi spasi berlebih
    .replace(/[ \t]{3,}/g, "  ");
}

export function cleanSectionsData(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((sec) => ({
    heading: sanitizeAcademicText(sec.heading || sec.title || "Bagian"),
    page: sec.page || 1,
    content: sanitizeAcademicText(sec.content || ""),
    tableHtml: sec.tableHtml ? sanitizeAcademicText(sec.tableHtml) : undefined,
    type: sec.type || "text",
  }));
}
