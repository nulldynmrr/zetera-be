/**
 * ── ZETERA CITATION ENGINE (CSL-COMPLIANT & DETERMINISTIC) ──
 * Mendukung 6 gaya sitasi standar akademik:
 * 1. APA (7th Edition)
 * 2. IEEE
 * 3. MLA (9th Edition)
 * 4. HARVARD
 * 5. VANCOUVER
 * 6. CHICAGO
 */

/**
 * Normalisasi nama penulis menjadi komponen Nama Belakang & Inisial.
 */
function parseAuthors(authorStr) {
  if (!authorStr || typeof authorStr !== "string") {
    return [{ lastName: "Penulis", initial: "P.", fullName: "Penulis" }];
  }

  const rawList = authorStr
    .split(/;|\band\b|&/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawList.length === 0) {
    return [{ lastName: "Penulis", initial: "P.", fullName: "Penulis" }];
  }

  return rawList.map((raw) => {
    // Format "Last, First"
    if (raw.includes(",")) {
      const parts = raw.split(",").map((p) => p.trim());
      const lastName = parts[0];
      const firstName = parts[1] || "";
      const initial = firstName ? `${firstName.charAt(0).toUpperCase()}.` : "";
      return { lastName, initial, fullName: `${lastName}, ${firstName}`.trim() };
    }

    // Format "First Middle Last"
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return { lastName: tokens[0], initial: "", fullName: tokens[0] };
    }
    const lastName = tokens[tokens.length - 1];
    const firstTokens = tokens.slice(0, -1);
    const initial = firstTokens.map((t) => `${t.charAt(0).toUpperCase()}.`).join(" ");
    return { lastName, initial, fullName: raw };
  });
}

function cleanDoi(doi) {
  if (!doi || doi === "-" || doi === "null" || doi === "undefined") return null;
  const cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  return cleaned ? `https://doi.org/${cleaned}` : null;
}

/**
 * Format entri Daftar Pustaka (Bibliography Entry)
 */
export function formatBibliography(journal, style = "IEEE", index = 1) {
  const normStyle = (style || "IEEE").toUpperCase();
  const authors = parseAuthors(journal.authors);
  const year = journal.year || "n.d.";
  const title = (journal.title || "Untitled Paper").trim().replace(/\.$/, "");
  const pub = (journal.publication || journal.venue || "").trim();
  const doiUrl = cleanDoi(journal.doi);
  const url = journal.url && journal.url.startsWith("http") ? journal.url : null;
  const link = doiUrl || url || "";

  switch (normStyle) {
    case "APA":
    case "APA7": {
      // APA 7th: Last, F. M., & Last, F. M. (Year). Title. Publication. https://doi.org/...
      let authorText = "";
      if (authors.length === 1) {
        authorText = `${authors[0].lastName}${authors[0].initial ? `, ${authors[0].initial}` : ""}`;
      } else if (authors.length === 2) {
        authorText = `${authors[0].lastName}, ${authors[0].initial} & ${authors[1].lastName}, ${authors[1].initial}`;
      } else {
        const primary = authors[0];
        authorText = `${primary.lastName}, ${primary.initial} et al.`;
      }
      const pubPart = pub ? ` *${pub}*.` : "";
      const linkPart = link ? ` ${link}` : "";
      return `${authorText} (${year}). ${title}.${pubPart}${linkPart}`.trim();
    }

    case "IEEE": {
      // IEEE: [n] F. M. Last and F. M. Last, "Title," Publication, Year, doi: ...
      let authorText = "";
      if (authors.length === 1) {
        authorText = `${authors[0].initial ? `${authors[0].initial} ` : ""}${authors[0].lastName}`;
      } else if (authors.length === 2) {
        authorText = `${authors[0].initial ? `${authors[0].initial} ` : ""}${authors[0].lastName} and ${authors[1].initial ? `${authors[1].initial} ` : ""}${authors[1].lastName}`;
      } else {
        authorText = `${authors[0].initial ? `${authors[0].initial} ` : ""}${authors[0].lastName} et al.`;
      }
      const pubPart = pub ? ` *${pub}*,` : "";
      const doiPart = doiUrl ? ` doi: ${doiUrl}.` : ".";
      return `[${index}] ${authorText}, "${title}," ${pubPart} ${year}${doiPart}`.trim();
    }

    case "MLA": {
      // MLA 9th: Last, First. "Title." Publication, Year, link.
      const primary = authors[0];
      const authorText = authors.length > 2
        ? `${primary.fullName}, et al.`
        : authors.map((a) => a.fullName).join(", and ");
      const pubPart = pub ? ` *${pub}*,` : "";
      const linkPart = link ? ` ${link}` : "";
      return `${authorText}. "${title}."${pubPart} ${year}.${linkPart}`.trim();
    }

    case "HARVARD": {
      // Harvard: Last, I. (Year) 'Title', Publication. Available at: URL.
      const authorText = authors.length > 2
        ? `${authors[0].lastName}, ${authors[0].initial} et al.`
        : authors.map((a) => `${a.lastName}, ${a.initial}`).join(" and ");
      const pubPart = pub ? `, *${pub}*` : "";
      const linkPart = link ? `. Tersedia di: <${link}>` : ".";
      return `${authorText} (${year}) '${title}'${pubPart}${linkPart}`.trim();
    }

    case "VANCOUVER": {
      // Vancouver: n. Last I, Last I. Title. Publication. Year; doi.
      const authorText = authors
        .slice(0, 6)
        .map((a) => `${a.lastName} ${a.initial.replace(/\./g, "")}`)
        .join(", ") + (authors.length > 6 ? ", et al" : "");
      const pubPart = pub ? ` ${pub}.` : "";
      const doiPart = doiUrl ? ` Available from: ${doiUrl}` : "";
      return `${index}. ${authorText}. ${title}.${pubPart} ${year}.${doiPart}`.trim();
    }

    case "CHICAGO": {
      // Chicago Author-Date: Last, First. Year. "Title." Publication. link.
      const primary = authors[0];
      const authorText = authors.length > 3
        ? `${primary.fullName} et al.`
        : authors.map((a) => a.fullName).join(", and ");
      const pubPart = pub ? ` *${pub}*.` : "";
      const linkPart = link ? ` ${link}` : "";
      return `${authorText}. ${year}. "${title}."${pubPart}${linkPart}`.trim();
    }

    default:
      // Fallback ke APA 7th
      return formatBibliography(journal, "APA", index);
  }
}

/**
 * Format sitasi dalam naskah (In-Text Citation)
 * Contoh:
 * - APA: (Smith, 2024) atau (Smith & Doe, 2024) atau (Smith et al., 2024)
 * - IEEE: [1]
 * - MLA: (Smith)
 * - Harvard: (Smith, 2024)
 * - Vancouver: (1) atau [1]
 * - Chicago: (Smith 2024)
 */
export function formatInTextCitation(journal, style = "IEEE", index = 1, page = null) {
  const normStyle = (style || "IEEE").toUpperCase();
  const authors = parseAuthors(journal.authors);
  const year = journal.year || "n.d.";
  const primaryAuthor = authors[0]?.lastName || "Penulis";
  const pageStr = page && Number(page) > 0 ? `, hlm. ${page}` : "";

  switch (normStyle) {
    case "APA":
    case "APA7":
      if (authors.length === 1) {
        return `(${primaryAuthor}, ${year}${pageStr})`;
      } else if (authors.length === 2) {
        return `(${primaryAuthor} & ${authors[1].lastName}, ${year}${pageStr})`;
      } else {
        return `(${primaryAuthor} et al., ${year}${pageStr})`;
      }

    case "IEEE":
      return page && Number(page) > 0 ? `[${index}, hlm. ${page}]` : `[${index}]`;

    case "MLA":
      return `(${primaryAuthor}${page ? ` ${page}` : ""})`;

    case "HARVARD":
      if (authors.length === 1) {
        return `(${primaryAuthor}, ${year}${pageStr})`;
      } else if (authors.length === 2) {
        return `(${primaryAuthor} and ${authors[1].lastName}, ${year}${pageStr})`;
      } else {
        return `(${primaryAuthor} et al., ${year}${pageStr})`;
      }

    case "VANCOUVER":
      return `[${index}]`;

    case "CHICAGO":
      return `(${primaryAuthor} ${year}${pageStr ? `, ${page}` : ""})`;

    default:
      return `[${index}]`;
  }
}
