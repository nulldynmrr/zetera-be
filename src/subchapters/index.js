/**
 * Central Subchapter Registry
 * Menyediakan registri modular seluruh sub-bab berbasis nama semantik (bukan nomor kaku).
 * Menggabungkan spesifikasi Resep Outline, Aturan Paper, dan Dynamic DB Synchronization.
 */

import { spec as latarBelakang } from "./latar-belakang/spec.js";
import { spec as identifikasiMasalah } from "./identifikasi-masalah/spec.js";
import { spec as rumusanMasalah } from "./rumusan-masalah/spec.js";
import { spec as batasanMasalah } from "./batasan-masalah/spec.js";
import { spec as tujuanPenelitian } from "./tujuan-penelitian/spec.js";
import { spec as manfaatPenelitian } from "./manfaat-penelitian/spec.js";
import { spec as sistematikaPenulisan } from "./sistematika-penulisan/spec.js";
import { spec as landasanTeori } from "./landasan-teori/spec.js";
import { spec as penelitianTerdahulu } from "./penelitian-terdahulu/spec.js";
import { spec as kerangkaBerpikir } from "./kerangka-berpikir/spec.js";
import { spec as hipotesisPenelitian } from "./hipotesis-penelitian/spec.js";
import { spec as pendekatanPenelitian } from "./pendekatan-penelitian/spec.js";
import { spec as objekLokasi } from "./objek-lokasi/spec.js";
import { spec as populasiSampel } from "./populasi-sampel/spec.js";
import { spec as pengumpulanData } from "./pengumpulan-data/spec.js";
import { spec as instrumenPenelitian } from "./instrumen-penelitian/spec.js";
import { spec as definisiOperasional } from "./definisi-operasional/spec.js";
import { spec as analisisData } from "./analisis-data/spec.js";
import { spec as ujiKeabsahan } from "./uji-keabsahan/spec.js";
import {
  coverSpec,
  approvalSpec,
  abstractSpec,
  referencesSpec,
  appendixSpec,
} from "./kelengkapan-dokumen/spec.js";

export const ALL_SUBCHAPTER_SPECS = [
  // Kelengkapan Dokumen (5)
  coverSpec,
  approvalSpec,
  abstractSpec,
  referencesSpec,
  appendixSpec,

  // Bab I — Pendahuluan (7)
  latarBelakang,
  identifikasiMasalah,
  rumusanMasalah,
  batasanMasalah,
  tujuanPenelitian,
  manfaatPenelitian,
  sistematikaPenulisan,

  // Bab II — Tinjauan Pustaka (4)
  landasanTeori,
  penelitianTerdahulu,
  kerangkaBerpikir,
  hipotesisPenelitian,

  // Bab III — Metodologi (8)
  pendekatanPenelitian,
  objekLokasi,
  populasiSampel,
  pengumpulanData,
  instrumenPenelitian,
  definisiOperasional,
  analisisData,
  ujiKeabsahan,
];

/**
 * Normalisasi string pencocokan
 */
function normalize(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mencari spesifikasi sub-bab berdasarkan slug semantik
 */
export function getSubchapterSpecBySlug(slug) {
  const norm = normalize(slug);
  return ALL_SUBCHAPTER_SPECS.find((s) => s.slug === norm) || null;
}

/**
 * Mencari spesifikasi sub-bab berdasarkan kode prompt resmi
 */
export function getSubchapterSpecByCode(code) {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return ALL_SUBCHAPTER_SPECS.find((s) => s.code === upper) || null;
}

/**
 * Resolver cerdas yang mencocokkan nama bebas/typo mahasiswa ke spec
 * Contoh: "latar belakar" -> Latar Belakang spec
 *         "ruang lingkup" -> Batasan Masalah spec
 */
export function resolveSubchapterSpec({ itemId = "", title = "", tag = "" } = {}) {
  const normTitle = normalize(title);
  const normTag = normalize(tag);
  const normItemId = normalize(itemId);

  // 1. Coba exact code match
  if (itemId) {
    const byCode = getSubchapterSpecByCode(itemId);
    if (byCode) return byCode;
  }

  // 2. Cek apakah ada alias yang cocok
  for (const spec of ALL_SUBCHAPTER_SPECS) {
    if (spec.aliases && spec.aliases.length > 0) {
      for (const alias of spec.aliases) {
        const normAlias = normalize(alias);
        if (
          normTitle.includes(normAlias) ||
          normAlias.includes(normTitle) ||
          normTag.includes(normAlias) ||
          normItemId === normAlias
        ) {
          return spec;
        }
      }
    }
  }

  return null;
}

/**
 * Helper interpolasi variabel dinamis
 */
export function interpolateVariables(templateText = "", variables = {}) {
  let result = templateText;
  for (const [key, val] of Object.entries(variables)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(re, typeof val === "object" ? JSON.stringify(val) : String(val ?? ""));
  }
  return result;
}
