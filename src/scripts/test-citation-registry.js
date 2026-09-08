/**
 * Test Verifikasi Citation Registry & Renumbering
 * Memastikan perbaikan bug Daftar Pustaka (§3 doc 020) berjalan sempurna
 */

import { resolveDocumentCitations } from "../lib/citation-registry.js";

console.log("🧪 Menjalankan pengujian Citation Registry...");

// Mock Journals
const mockJournals = [
  { id: "j1", title: "Optimasi Jaringan Syaraf", authors: "Budi, A.", year: 2023, doi: "10.1234/j1" },
  { id: "j2", title: "Kajian Latensi Cloud AI", authors: "Siti, M.", year: 2024, doi: "10.1234/j2" },
  { id: "j3", title: "Arsitektur Context Memory", authors: "Rian, D.", year: 2025, doi: "10.1234/j3" },
  { id: "j4", title: "Jurnal Tak Terpakai", authors: "Zeta, X.", year: 2022, doi: "10.1234/j4" },
];

// Mock Sub-bab Items
// Item 1.1 mengutip j2 ([1]) dan j3 ([2])
// Item 2.1 mengutip j1 ([1]) dan j2 ([2])
const mockOutlineItems = [
  {
    itemId: "1.1",
    title: "Latar Belakang",
    bab: 1,
    order: 1,
    userNotes: "Kajian terdahulu menunjukkan latensi tinggi pada inferensi [1]. Untuk itu diusulkan memori dinamis [2].",
    citedSourceIds: [
      { seq: 1, journalId: "j2" },
      { seq: 2, journalId: "j3" },
    ],
  },
  {
    itemId: "1.2",
    title: "Rumusan Masalah",
    bab: 1,
    order: 2,
    userNotes: "Bagaimana cara optimasi sistem?",
    citedSourceIds: [],
  },
  {
    itemId: "2.1",
    title: "Landasan Teori",
    bab: 2,
    order: 1,
    userNotes: "Teori jaringan syaraf [1] mendukung pengurangan beban latensi [2].",
    citedSourceIds: [
      { seq: 1, journalId: "j1" },
      { seq: 2, journalId: "j2" },
    ],
  },
];

const result = resolveDocumentCitations(mockOutlineItems, mockJournals);

console.log("Ordered Journals (Hanya yang dikutip, urutan kemunculan global):");
result.orderedJournals.forEach((j, idx) => {
  console.log(`  [${idx + 1}] ID: ${j.id} | ${j.title} (${j.authors}, ${j.year})`);
});

console.log("\nGlobal Citation Map:", result.globalCitationMap);

console.log("\nRewritten Outline Items Notes:");
result.rewrittenOutlineItems.forEach((item) => {
  console.log(`  Sub-bab ${item.itemId}: "${item.userNotes}"`);
});

// Assertions:
// Kemunculan pertama: j2 (Global 1), j3 (Global 2), j1 (Global 3).
// j4 tidak pernah dikutip sehingga TIDAK ADA di orderedJournals!
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

console.log("\nValidasi Aturan:");
assert(result.orderedJournals.length === 3, "Hanya 3 jurnal yang dikutip masuk ke orderedJournals (j4 diabaikan)");
assert(result.globalCitationMap["j2"] === 1, "j2 pertama kali muncul di 1.1 -> Global [1]");
assert(result.globalCitationMap["j3"] === 2, "j3 kedua muncul di 1.1 -> Global [2]");
assert(result.globalCitationMap["j1"] === 3, "j1 muncul di 2.1 -> Global [3]");

const item1_1 = result.rewrittenOutlineItems.find((i) => i.itemId === "1.1");
assert(item1_1.userNotes.includes("[1]") && item1_1.userNotes.includes("[2]"), "Item 1.1 remapped ke [1] dan [2]");

const item2_1 = result.rewrittenOutlineItems.find((i) => i.itemId === "2.1");
// j1 is global [3], j2 is global [1]
assert(item2_1.userNotes.includes("[3]") && item2_1.userNotes.includes("[1]"), "Item 2.1 local [1] (j1) -> global [3], local [2] (j2) -> global [1]");

console.log("\n🎉 Seluruh pengujian Citation Registry lulus 100%!");
