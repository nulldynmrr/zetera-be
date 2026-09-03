import { prisma } from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────
// ProposalTemplate Service — Masalah 3
// Sesuai blueprint §3.3: system default + user-cloneable templates
// ─────────────────────────────────────────────────────────────

/**
 * List templates: system defaults + user's own templates
 */
export async function listTemplates(userId) {
  return prisma.proposalTemplate.findMany({
    where: {
      OR: [
        { ownerId: null },         // system defaults
        { ownerId: userId },       // user's own
      ],
    },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * Get single template with sections
 */
export async function getTemplate(templateId, userId) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    const err = new Error("Template tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  // System templates boleh dilihat semua user
  if (template.ownerId && template.ownerId !== userId) {
    const err = new Error("Tidak memiliki akses ke template ini");
    err.statusCode = 403;
    throw err;
  }

  return template;
}

/**
 * Clone a template for a user (create copy with ownerId = userId)
 */
export async function cloneTemplate(templateId, userId, newName) {
  const source = await getTemplate(templateId, userId);

  const cloned = await prisma.proposalTemplate.create({
    data: {
      ownerId: userId,
      name: newName || `${source.name} (Salinan)`,
      sourceFaculty: source.sourceFaculty,
      isDefault: false,
      sections: {
        create: source.sections.map((s) => ({
          order: s.order,
          title: s.title,
          isOptional: s.isOptional,
          guidanceText: s.guidanceText,
        })),
      },
    },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
    },
  });

  return cloned;
}

/**
 * Update template name / sections order (drag-reorder)
 * Hanya bisa edit template milik sendiri (bukan system default)
 */
export async function updateTemplate(templateId, userId, { name, sections }) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    const err = new Error("Template tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (template.ownerId !== userId) {
    const err = new Error(
      "Tidak bisa mengedit template system. Gunakan 'Clone' terlebih dahulu."
    );
    err.statusCode = 403;
    throw err;
  }

  const updateData = {};
  if (name) updateData.name = name;

  // Update sections jika ada (reorder / edit guidance)
  if (sections && Array.isArray(sections)) {
    // Hapus semua sections lama lalu buat ulang
    await prisma.proposalTemplateSection.deleteMany({
      where: { templateId },
    });

    updateData.sections = {
      create: sections.map((s, idx) => ({
        order: s.order !== undefined ? s.order : idx + 1,
        title: s.title,
        isOptional: s.isOptional ?? false,
        guidanceText: s.guidanceText || null,
      })),
    };
  }

  return prisma.proposalTemplate.update({
    where: { id: templateId },
    data: updateData,
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
    },
  });
}

/**
 * Delete user's own template
 */
export async function deleteTemplate(templateId, userId) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    const err = new Error("Template tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!template.ownerId || template.ownerId !== userId) {
    const err = new Error("Tidak bisa menghapus template system");
    err.statusCode = 403;
    throw err;
  }

  return prisma.proposalTemplate.delete({
    where: { id: templateId },
  });
}

export const DEFAULT_NUMBERING_CONFIG = {
  bab: "ROMAN",                       // BAB I, BAB II
  subBab: "DECIMAL_DOT",              // 1.1, 1.2
  subSubBab: "DECIMAL_DOT_DECIMAL",   // 1.1.1
  level4: "LOWER_ALPHA_DOT",          // a., b.
  level5: "DECIMAL_PAREN",            // 1), 2)
  level6: "LOWER_ALPHA_PAREN",        // a), b)
};

/**
 * Format numbering string according to hierarchy level and numbering config
 */
export function formatSectionNumber(level, indices, config = DEFAULT_NUMBERING_CONFIG) {
  const [b = 1, s = 1, ss = 1, l4 = 1, l5 = 1, l6 = 1] = indices;
  const toRoman = (num) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][num - 1] || `${num}`;
  const toAlpha = (num) => String.fromCharCode(96 + num); // 1 -> 'a', 2 -> 'b'

  switch (level) {
    case 1: // BAB
      return `BAB ${toRoman(b)}`;
    case 2: // Sub-bab
      return `${b}.${s}`;
    case 3: // Sub-sub-bab
      return `${b}.${s}.${ss}`;
    case 4: // Level 4
      return `${toAlpha(l4)}.`;
    case 5: // Level 5
      return `${l5})`;
    case 6: // Level 6
      return `${toAlpha(l6)})`;
    default:
      return `${b}.${s}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Seed: Template Default "Informatika FIF" — Telkom University
// Sesuai blueprint §3.1: dari Template_Proposal_FIF__1_.docx
// Dipanggil 1x dari seed script / startup check
// ─────────────────────────────────────────────────────────────
export async function seedDefaultTemplate() {
  const existing = await prisma.proposalTemplate.findFirst({
    where: { isDefault: true, ownerId: null },
  });

  if (existing) {
    return { seeded: false, message: "Template default sudah ada" };
  }

  const template = await prisma.proposalTemplate.create({
    data: {
      ownerId: null,      // system default
      name: "Proposal Tugas Akhir — Informatika FIF Telkom University",
      sourceFaculty: "Fakultas Informatika",
      isDefault: true,
      numberingConfig: DEFAULT_NUMBERING_CONFIG,
      sections: {
        create: [
          {
            order: 1,
            title: "Halaman Sampul (Cover)",
            isOptional: false,
            guidanceText:
              "Berisi: Judul Proposal Tugas Akhir, Nama Mahasiswa, NIM, Logo Institusi, Program Studi S1 Teknik Informatika, Fakultas Informatika, Universitas Telkom, Tahun.",
          },
          {
            order: 2,
            title: "Lembar Pengesahan & Lembar Orisinalitas",
            isOptional: false,
            guidanceText:
              "Berisi: Lembar persetujuan Dosen Pembimbing 1 & 2 serta pernyataan orisinalitas bermeterai.",
          },
          {
            order: 3,
            title: "Abstrak & Abstract",
            isOptional: false,
            guidanceText:
              "Ringkasan penelitian dalam Bahasa Indonesia dan Bahasa Inggris (250–350 kata), latar belakang ringkas, metode, dan target capaian/metrik.",
          },
          {
            order: 4,
            title: "Kata Pengantar",
            isOptional: false,
            guidanceText:
              "Pernyataan syukur dan apresiasi ucapan terima kasih kepada pimpinan institusi, dosen pembimbing, dan pihak pendukung.",
          },
          {
            order: 5,
            title: "BAB I PENDAHULUAN",
            isOptional: false,
            guidanceText:
              "1.1 Latar Belakang (fenomena empiris, urgensi, justifikasi metode dengan sitasi [1])\n" +
              "1.2 Perumusan Masalah\n" +
              "1.3 Batasan Masalah (dataset, model, parameter)\n" +
              "1.4 Tujuan Penelitian\n" +
              "1.5 Manfaat Penelitian (teoretis & praktis)",
          },
          {
            order: 6,
            title: "BAB II LANDASAN TEORI",
            isOptional: false,
            guidanceText:
              "2.1 Tinjauan Pustaka (rangkuman studi terdahulu, matriks perbandingan, dan research gap)\n" +
              "2.2 Landasan Teori (konsep teknis, preprocessing, representasi fitur/embedding, algoritma pemodelan, dan metrik evaluasi)",
          },
          {
            order: 7,
            title: "BAB III METODE PENELITIAN",
            isOptional: false,
            guidanceText:
              "3.1 Subjek dan Objek Penelitian\n" +
              "3.2 Alat dan Bahan Penelitian (Hardware, Software, Dataset)\n" +
              "3.3 Diagram Alur Penelitian (Pengumpulan Data, Preprocessing, Pelabelan, Pemodelan, Skenario Eksperimen & Pengujian)",
          },
          {
            order: 8,
            title: "Daftar Pustaka",
            isOptional: false,
            guidanceText:
              "Standar IEEE menggunakan format nomor urut sitasi dalam kurung siku [1], [2], dilengkapi DOI artikel rujukan.",
          },
          {
            order: 9,
            title: "Lampiran",
            isOptional: true,
            guidanceText:
              "Opsional. Bukti pengambilan dataset, potongan kode implementasi, atau surat validasi pakar.",
          },
        ],
      },
    },
    include: { sections: true },
  });

  return {
    seeded: true,
    message: "Template default 'Informatika FIF' berhasil dibuat",
    template,
  };
}

