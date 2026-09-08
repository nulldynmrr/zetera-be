import { parseSubchapterBlocks, renderBlocksToLatex } from "../lib/render-engine/index.js";

const testText = `Paragraf pertama latar belakang riset tugas akhir.

![Bagan Siklus PTK](/uploads/siklus.png)

Tabel 2.1: Perbandingan Algoritma
| Algoritma | Akurasi | Waktu |
|---|---|---|
| SVM | 88% | 12ms |
| CNN | 94% | 45ms |

Paragraf penutup telaah pustaka.`;

const blocks = parseSubchapterBlocks(testText);
console.log("Parsed blocks count:", blocks.length);
console.log("Block types:", blocks.map((b) => b.type));
console.log("Blocks detail:\n", JSON.stringify(blocks, null, 2));

const { latexString } = renderBlocksToLatex(testText, (s) => s, { chapterPrefix: "2" });
console.log("\nGenerated LaTeX:\n", latexString);
