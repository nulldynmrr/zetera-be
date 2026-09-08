/**
 * Citation Registry — Global Citation Synchronization Engine
 * Sesuai Dokumen Perbaikan Zetera 020 (§3)
 *
 * Mengumpulkan seluruh citedSourceIds di setiap sub-bab (ResearchOutlineItem),
 * memberikan nomor urut global [1], [2], ... yang konsisten lintas dokumen,
 * dan mere-map marker kurung siku di teks userNotes secara aman.
 */

/**
 * Normalisasi dan renumber sitasi dokumen secara global.
 * @param {Array} outlineItems - Daftar ResearchOutlineItem suatu proyek (diurutkan bab & order)
 * @param {Array} poolJournals - Seluruh jurnal terdaftar pada proyek
 * @returns {{
 *   orderedJournals: Array,
 *   rewrittenOutlineItems: Array,
 *   globalCitationMap: Object,
 *   citedCount: number
 * }}
 */
export function resolveDocumentCitations(outlineItems = [], poolJournals = []) {
  const journalsById = new Map();
  const journalsByDoi = new Map();

  for (const j of poolJournals) {
    if (j.id) journalsById.set(j.id, j);
    if (j.doi && j.doi !== "-") {
      const cleanDoi = j.doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
      journalsByDoi.set(cleanDoi, j);
    }
  }

  // 1. Urutkan outlineItems sesuai struktur dokumen (Bab asc, Order asc, ItemId asc)
  const sortedItems = [...outlineItems].sort((a, b) => {
    const babA = a.bab ?? parseInt(String(a.itemId).split(".")[0]) ?? 0;
    const babB = b.bab ?? parseInt(String(b.itemId).split(".")[0]) ?? 0;
    if (babA !== babB) return babA - babB;

    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;

    return String(a.itemId || "").localeCompare(String(b.itemId || ""), undefined, { numeric: true });
  });

  // 2. Kumpulkan urutan kemunculan pertama jurnal (First-Cited-First-Numbered)
  const globalCitationMap = new Map(); // journalId -> globalNumber (1-based)
  const orderedJournals = [];

  const registerJournal = (journalObj) => {
    if (!journalObj || !journalObj.id) return null;
    if (globalCitationMap.has(journalObj.id)) {
      return globalCitationMap.get(journalObj.id);
    }
    const newIndex = orderedJournals.length + 1;
    globalCitationMap.set(journalObj.id, newIndex);
    orderedJournals.push(journalObj);
    return newIndex;
  };

  // Pre-pass: scan citedSourceIds & evidence
  for (const item of sortedItems) {
    const rawCitations = item.citedSourceIds;

    if (Array.isArray(rawCitations)) {
      for (const entry of rawCitations) {
        let jId = typeof entry === "string" ? entry : entry?.journalId || entry?.id;
        let journal = jId ? journalsById.get(jId) : null;

        if (!journal && typeof entry === "object" && entry?.doi) {
          const clean = entry.doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
          journal = journalsByDoi.get(clean);
        }

        if (journal) {
          registerJournal(journal);
        }
      }
    } else if (Array.isArray(item.evidence)) {
      // Fallback data lama sebelum citedSourceIds ditulis
      for (const ev of item.evidence) {
        let journal = ev?.journalId ? journalsById.get(ev.journalId) : null;
        if (!journal && ev?.doi) {
          const clean = ev.doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
          journal = journalsByDoi.get(clean);
        }
        if (!journal && ev?.title) {
          journal = poolJournals.find((p) => p.title && p.title.toLowerCase() === ev.title.toLowerCase());
        }
        if (journal) {
          registerJournal(journal);
        }
      }
    }
  }

  // Jika belum ada satupun jurnal yang dicatat lewat citedSourceIds (misal draf baru atau legacy),
  // masukkan semua jurnal approved/pool berurutan agar Daftar Pustaka tetap valid dan tidak kosong
  if (orderedJournals.length === 0 && poolJournals.length > 0) {
    for (const j of poolJournals) {
      registerJournal(j);
    }
  }

  // 3. Tulis ulang (rewrite) marker sitasi di setiap item
  const rewrittenOutlineItems = sortedItems.map((item) => {
    let notes = item.userNotes || "";
    if (!notes) return { ...item };

    const rawCitations = item.citedSourceIds;
    const localToGlobalSeq = new Map(); // localSeqNumber -> globalNumber

    if (Array.isArray(rawCitations) && rawCitations.length > 0) {
      rawCitations.forEach((entry, idx) => {
        let localSeq = typeof entry === "object" && typeof entry?.seq === "number" ? entry.seq : idx + 1;
        let jId = typeof entry === "string" ? entry : entry?.journalId || entry?.id;
        let journal = jId ? journalsById.get(jId) : null;

        if (journal && globalCitationMap.has(journal.id)) {
          localToGlobalSeq.set(localSeq, globalCitationMap.get(journal.id));
        }
      });
    } else {
      // Fallback mapping: urutan indeks pool lama
      poolJournals.forEach((j, idx) => {
        const localSeq = idx + 1;
        if (globalCitationMap.has(j.id)) {
          localToGlobalSeq.set(localSeq, globalCitationMap.get(j.id));
        }
      });
    }

    if (localToGlobalSeq.size > 0) {
      // Tahap 1: Ganti ke placeholder unik untuk menghindari tabrakan angka
      // Contoh: [1] -> __ZETERA_CITE_4__
      for (const [localSeq, globalSeq] of localToGlobalSeq.entries()) {
        const regex = new RegExp(`\\[${localSeq}\\]`, "g");
        notes = notes.replace(regex, `__ZETERA_CITE_${globalSeq}__`);
      }
      // Tahap 2: Kembalikan placeholder ke format kurung siku [globalSeq]
      notes = notes.replace(/__ZETERA_CITE_(\d+)__/g, "[$1]");
    }

    return {
      ...item,
      userNotes: notes,
    };
  });

  return {
    orderedJournals,
    rewrittenOutlineItems,
    globalCitationMap: Object.fromEntries(globalCitationMap),
    citedCount: orderedJournals.length,
  };
}
