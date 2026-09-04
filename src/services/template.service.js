import { prisma } from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────
// ProposalTemplate Service — Masalah 3 & PRD 013
// System-managed + user-cloneable templates with Variables & Package Assets
// ─────────────────────────────────────────────────────────────

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

/**
 * Helper to enrich template object with custom configs stored in numberingConfig
 */
export function enrichTemplateWithMetadata(t) {
  if (!t) return t;
  const cfg = (typeof t.numberingConfig === "object" && t.numberingConfig) ? t.numberingConfig : {};
  return {
    ...t,
    description: t.description || cfg.description || null,
    preamble: cfg.preamble || null,
    marginConfig: cfg.marginConfig || null,
    rawLatex: cfg.rawLatex || null,
    latexSource: cfg.latexSource || null,
    packageDetails: cfg.packageDetails || null,
  };
}

/**
 * List templates: system defaults + user's own templates
 */
export async function listTemplates(userId) {
  const templates = await prisma.proposalTemplate.findMany({
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
      variables: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return templates.map(enrichTemplateWithMetadata);
}

/**
 * Get single template with sections & variables
 */
export async function getTemplate(templateId, userId) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
      variables: {
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

  return enrichTemplateWithMetadata(template);
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
      sourceCampus: source.sourceCampus,
      formatType: source.formatType,
      status: "DRAFT",
      version: 1,
      isDefault: false,
      numberingConfig: source.numberingConfig || DEFAULT_NUMBERING_CONFIG,
      sections: {
        create: source.sections.map((s) => ({
          order: s.order,
          title: s.title,
          isOptional: s.isOptional,
          guidanceText: s.guidanceText,
        })),
      },
      variables: {
        create: (source.variables || []).map((v) => ({
          key: v.key,
          label: v.label,
          varType: v.varType,
          required: v.required,
          defaultValue: v.defaultValue,
          defaultAssetId: v.defaultAssetId,
          bindingKey: v.bindingKey,
          order: v.order,
        })),
      },
    },
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
      variables: {
        orderBy: { order: "asc" },
      },
    },
  });

  return cloned;
}

/**
 * Create new template
 */
export async function createTemplate(
  userId,
  data,
  isAdmin = false
) {
  const {
    name,
    description,
    formatType = "LATEX",
    status = "PUBLISHED",
    version = 1,
    sourceFaculty,
    sourceCampus,
    institution,
    university,
    faculty,
    preamble,
    marginConfig,
    rawLatex,
    latexSource,
    packageDetails,
    numberingConfig,
    isDefault = false,
    sections = [],
    variables = [],
  } = data || {};

  if (!name || !name.trim()) {
    const err = new Error("Nama template wajib diisi");
    err.statusCode = 400;
    throw err;
  }

  const numConfig = {
    ...DEFAULT_NUMBERING_CONFIG,
    ...(typeof numberingConfig === "object" && numberingConfig ? numberingConfig : {}),
    description: description || null,
    marginConfig: marginConfig || null,
    preamble: preamble || null,
    rawLatex: rawLatex || null,
    latexSource: latexSource || null,
    packageDetails: packageDetails || null,
  };

  const parsedVersion = typeof version === "number" ? version : (parseInt(version, 10) || 1);

  const createPayload = {
    name: name.trim(),
    sourceFaculty: sourceFaculty || faculty || null,
    sourceCampus: sourceCampus || institution || university || null,
    formatType: formatType === "DOCX" ? "DOCX" : "LATEX",
    status: status || "PUBLISHED",
    version: parsedVersion,
    ownerId: userId || null,
    isDefault: Boolean(isDefault),
    numberingConfig: numConfig,
    sections: {
      create: (sections || []).map((s, idx) => ({
        order: s.order !== undefined ? s.order : idx + 1,
        title: s.title || `Bagian ${idx + 1}`,
        isOptional: s.isOptional ?? false,
        guidanceText: s.guidanceText || null,
      })),
    },
    variables: {
      create: (variables || []).map((v, idx) => ({
        key: v.key,
        label: v.label || v.key,
        varType: v.varType === "IMAGE" ? "IMAGE" : "TEXT",
        required: v.required ?? true,
        defaultValue: v.defaultValue || null,
        defaultAssetId: v.defaultAssetId || null,
        bindingKey: v.bindingKey || v.key,
        order: v.order !== undefined ? v.order : idx + 1,
      })),
    },
  };

  const created = await prisma.proposalTemplate.create({
    data: createPayload,
    include: {
      sections: { orderBy: { order: "asc" } },
      variables: { orderBy: { order: "asc" } },
    },
  });

  return enrichTemplateWithMetadata(created);
}

/**
 * Update template name / sections order / variables
 * Admin atau pemilik template bisa melakukan update
 */
export async function updateTemplate(
  templateId,
  userId,
  data,
  isAdmin = false
) {
  const {
    name,
    description,
    formatType,
    sourceFaculty,
    sourceCampus,
    preamble,
    marginConfig,
    rawLatex,
    latexSource,
    packageDetails,
    numberingConfig,
    sections,
    variables,
  } = data || {};

  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    const err = new Error("Template tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!isAdmin && template.ownerId !== userId) {
    const err = new Error(
      "Tidak bisa mengedit template system. Gunakan 'Clone' terlebih dahulu."
    );
    err.statusCode = 403;
    throw err;
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (formatType) updateData.formatType = formatType;
  if (sourceFaculty !== undefined) updateData.sourceFaculty = sourceFaculty;
  if (sourceCampus !== undefined) updateData.sourceCampus = sourceCampus;

  const currentCfg = (typeof template.numberingConfig === "object" && template.numberingConfig) ? template.numberingConfig : {};
  const updatedCfg = {
    ...currentCfg,
    ...(typeof numberingConfig === "object" && numberingConfig ? numberingConfig : {}),
    ...(description !== undefined ? { description } : {}),
    ...(preamble !== undefined ? { preamble } : {}),
    ...(marginConfig !== undefined ? { marginConfig } : {}),
    ...(rawLatex !== undefined ? { rawLatex } : {}),
    ...(latexSource !== undefined ? { latexSource } : {}),
    ...(packageDetails !== undefined ? { packageDetails } : {}),
  };
  updateData.numberingConfig = updatedCfg;

  // Update sections jika ada
  if (sections && Array.isArray(sections)) {
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

  // Update variables jika ada
  if (variables && Array.isArray(variables)) {
    await prisma.templateVariable.deleteMany({
      where: { templateId },
    });

    updateData.variables = {
      create: variables.map((v, idx) => ({
        key: v.key,
        label: v.label || v.key,
        varType: v.varType || "TEXT",
        required: v.required ?? true,
        defaultValue: v.defaultValue || null,
        defaultAssetId: v.defaultAssetId || null,
        bindingKey: v.bindingKey || v.key,
        order: v.order !== undefined ? v.order : idx + 1,
      })),
    };
  }

  const updated = await prisma.proposalTemplate.update({
    where: { id: templateId },
    data: updateData,
    include: {
      sections: {
        orderBy: { order: "asc" },
      },
      variables: {
        orderBy: { order: "asc" },
      },
    },
  });

  return enrichTemplateWithMetadata(updated);
}

/**
 * Delete template (Admin or owner)
 */
export async function deleteTemplate(templateId, userId, isAdmin = false) {
  const template = await prisma.proposalTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    const err = new Error("Template tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  if (!isAdmin && (!template.ownerId || template.ownerId !== userId)) {
    const err = new Error("Tidak bisa menghapus template system");
    err.statusCode = 403;
    throw err;
  }

  return prisma.proposalTemplate.delete({
    where: { id: templateId },
  });
}

/**
 * Get variables for a template
 */
export async function getTemplateVariables(templateId, userId) {
  const template = await getTemplate(templateId, userId);
  return template.variables || [];
}

/**
 * Update variables of a template
 */
export async function updateTemplateVariables(templateId, userId, variables) {
  return updateTemplate(templateId, userId, { variables });
}

// ─────────────────────────────────────────────────────────────
// Fuzzy Section Matching for Non-Destructive Template Switching
// PRD 013 §7 & §9
// ─────────────────────────────────────────────────────────────

const ACADEMIC_SYNONYMS = {
  "pendahuluan": ["latar belakang", "background", "introduction", "bab 1", "bab i"],
  "latar belakang": ["background", "pendahuluan", "introduction", "latar belakang masalah"],
  "rumusan masalah": ["problem formulation", "research question", "pertanyaan penelitian", "perumusan masalah"],
  "tujuan penelitian": ["research objective", "aim", "purpose", "tujuan"],
  "kajian pustaka": ["tinjauan pustaka", "literature review", "landasan teori", "state of the art", "related work", "bab 2", "bab ii"],
  "landasan teori": ["tinjauan pustaka", "literature review", "teori", "kerangka teori", "theoretical framework"],
  "metodologi": ["metode penelitian", "research method", "materials and methods", "perancangan sistem", "bab 3", "bab iii"],
  "perancangan sistem": ["metodologi", "desain sistem", "alur pemodelan", "arsitektur sistem"],
  "daftar pustaka": ["references", "bibliography", "rujukan", "pustaka"],
  "abstrak": ["abstract", "ringkasan", "intisari"],
  "cover": ["sampul", "halaman judul", "title page"],
  "pengesahan": ["lembar persetujuan", "approval", "lembar pengesahan"],
};

function calculateSimilarity(str1, str2) {
  const s1 = (str1 || "").toLowerCase().trim();
  const s2 = (str2 || "").toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  for (const [key, list] of Object.entries(ACADEMIC_SYNONYMS)) {
    const s1Match = s1.includes(key) || list.some((item) => s1.includes(item));
    const s2Match = s2.includes(key) || list.some((item) => s2.includes(item));
    if (s1Match && s2Match) return 0.90;
  }

  // Simple bigram dice coefficient
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  b1.forEach((bg) => {
    if (b2.has(bg)) intersection++;
  });

  const total = b1.size + b2.size;
  return total === 0 ? 0 : (2 * intersection) / total;
}

/**
 * Preview switching template: calculates section matching and variable preservation
 */
export async function previewSwitchTemplate(projectId, userId, targetTemplateId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      template: {
        include: { sections: true, variables: true },
      },
    },
  });

  if (!project) {
    const err = new Error("Proyek tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const targetTemplate = await prisma.proposalTemplate.findUnique({
    where: { id: targetTemplateId },
    include: {
      sections: { orderBy: { order: "asc" } },
      variables: { orderBy: { order: "asc" } },
    },
  });

  if (!targetTemplate) {
    const err = new Error("Template target tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const sourceSections = project.template?.sections || [];
  const targetSections = targetTemplate.sections || [];

  const matchedSections = [];
  const usedTargetIds = new Set();

  // Match each source section to best target section
  for (const src of sourceSections) {
    let bestMatch = null;
    let highestScore = 0;

    for (const tgt of targetSections) {
      if (usedTargetIds.has(tgt.id)) continue;
      const score = calculateSimilarity(src.title, tgt.title);
      if (score > highestScore && score >= 0.4) {
        highestScore = score;
        bestMatch = tgt;
      }
    }

    if (bestMatch) {
      usedTargetIds.add(bestMatch.id);
      matchedSections.push({
        sourceSectionId: src.id,
        sourceTitle: src.title,
        targetSectionId: bestMatch.id,
        targetTitle: bestMatch.title,
        confidence: Number(highestScore.toFixed(2)),
      });
    } else {
      matchedSections.push({
        sourceSectionId: src.id,
        sourceTitle: src.title,
        targetSectionId: null,
        targetTitle: null,
        confidence: 0,
        status: "UNMAPPED_PRESERVED",
      });
    }
  }

  const newEmptySections = targetSections
    .filter((tgt) => !usedTargetIds.has(tgt.id))
    .map((tgt) => ({
      targetSectionId: tgt.id,
      targetTitle: tgt.title,
      order: tgt.order,
    }));

  return {
    projectId,
    currentTemplate: project.template ? { id: project.template.id, name: project.template.name } : null,
    targetTemplate: { id: targetTemplate.id, name: targetTemplate.name, formatType: targetTemplate.formatType },
    matchedSections,
    newEmptySections,
    targetVariables: targetTemplate.variables || [],
  };
}

/**
 * Commit template switch: applies mapping, sets project.templateId, and preserves unmapped drafts
 */
export async function commitSwitchTemplate(projectId, userId, targetTemplateId, customMapping = {}) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Proyek tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const targetTemplate = await prisma.proposalTemplate.findUnique({
    where: { id: targetTemplateId },
    include: { sections: true, variables: true },
  });

  if (!targetTemplate) {
    const err = new Error("Template target tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const updatedProject = await prisma.researchProject.update({
    where: { id: projectId },
    data: {
      templateId: targetTemplate.id,
      templateVersion: targetTemplate.version || 1,
    },
    include: {
      template: {
        include: {
          sections: { orderBy: { order: "asc" } },
          variables: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  return updatedProject;
}

// ─────────────────────────────────────────────────────────────
// Seed Standard Templates & Variables (Telkom FIF & General DOCX)
// ─────────────────────────────────────────────────────────────

export const TELKOM_FIF_VARIABLES = [
  { key: "JUDUL_PROPOSAL", label: "Judul Proposal Skripsi / TA", varType: "TEXT", required: true, bindingKey: "\\Title", order: 1 },
  { key: "JUDUL_INGGRIS", label: "Judul Proposal (Bahasa Inggris)", varType: "TEXT", required: false, bindingKey: "\\EngTitle", order: 2 },
  { key: "NAMA_MAHASISWA", label: "Nama Lengkap Mahasiswa", varType: "TEXT", required: true, bindingKey: "\\Author", order: 3 },
  { key: "NIM", label: "Nomor Induk Mahasiswa (NIM)", varType: "TEXT", required: true, bindingKey: "\\NIM", order: 4 },
  { key: "PROGRAM_STUDI", label: "Program Studi", varType: "TEXT", required: true, bindingKey: "\\Prodi", defaultValue: "S1 Informatika", order: 5 },
  { key: "FAKULTAS", label: "Fakultas", varType: "TEXT", required: true, bindingKey: "\\Fakultas", defaultValue: "Fakultas Informatika", order: 6 },
  { key: "UNIVERSITAS", label: "Universitas", varType: "TEXT", required: true, bindingKey: "\\Universitas", defaultValue: "Universitas Telkom", order: 7 },
  { key: "PEMBIMBING_1", label: "Dosen Pembimbing 1", varType: "TEXT", required: true, bindingKey: "\\PembimbingSatu", order: 8 },
  { key: "NIP_PEMBIMBING_1", label: "NIP/NIDN Pembimbing 1", varType: "TEXT", required: false, bindingKey: "\\NIPPembimbingSatu", order: 9 },
  { key: "PEMBIMBING_2", label: "Dosen Pembimbing 2", varType: "TEXT", required: false, bindingKey: "\\PembimbingDua", order: 10 },
  { key: "NIP_PEMBIMBING_2", label: "NIP/NIDN Pembimbing 2", varType: "TEXT", required: false, bindingKey: "\\NIPPembimbingDua", order: 11 },
  { key: "KAPRODI", label: "Ketua Program Studi", varType: "TEXT", required: false, bindingKey: "\\Kaprodi", defaultValue: "Dr. Erwin Budi Setiawan, S.Si., M.T.", order: 12 },
  { key: "NIP_KAPRODI", label: "NIP/NIDN Kaprodi", varType: "TEXT", required: false, bindingKey: "\\NIPKaprodi", defaultValue: "00760045", order: 13 },
  { key: "LOGO", label: "Logo Universitas / Institusi", varType: "IMAGE", required: false, bindingKey: "Tel-U-Logo.png", defaultAssetId: "Tel-U-Logo.png", order: 14 },
];

export const GENERAL_DOCX_VARIABLES = [
  { key: "JUDUL_PROPOSAL", label: "Judul Naskah Proposal", varType: "TEXT", required: true, bindingKey: "{{judul_proposal}}", order: 1 },
  { key: "NAMA_MAHASISWA", label: "Nama Mahasiswa", varType: "TEXT", required: true, bindingKey: "{{nama_mahasiswa}}", order: 2 },
  { key: "NIM", label: "NIM / NPM", varType: "TEXT", required: true, bindingKey: "{{nim}}", order: 3 },
  { key: "PROGRAM_STUDI", label: "Program Studi", varType: "TEXT", required: true, bindingKey: "{{program_studi}}", order: 4 },
  { key: "FAKULTAS", label: "Fakultas", varType: "TEXT", required: true, bindingKey: "{{fakultas}}", order: 5 },
  { key: "UNIVERSITAS", label: "Perguruan Tinggi", varType: "TEXT", required: true, bindingKey: "{{universitas}}", order: 6 },
  { key: "PEMBIMBING_1", label: "Dosen Pembimbing Utama", varType: "TEXT", required: true, bindingKey: "{{pembimbing_1}}", order: 7 },
  { key: "NIP_PEMBIMBING_1", label: "NIP/NIDN Pembimbing Utama", varType: "TEXT", required: false, bindingKey: "{{nip_pembimbing_1}}", order: 8 },
  { key: "KAPRODI", label: "Ketua Jurusan / Kaprodi", varType: "TEXT", required: false, bindingKey: "{{kaprodi}}", order: 9 },
  { key: "LOGO", label: "Logo Universitas", varType: "IMAGE", required: false, bindingKey: "zetera:LOGO", order: 10 },
];

export async function seedDefaultTemplate() {
  // 1. Template Telkom FIF (LaTeX)
  let fifTemplate = await prisma.proposalTemplate.findFirst({
    where: { isDefault: true, ownerId: null },
    include: { variables: true, sections: true },
  });

  if (!fifTemplate) {
    fifTemplate = await prisma.proposalTemplate.create({
      data: {
        ownerId: null,
        name: "Proposal Tugas Akhir — Informatika FIF Telkom University",
        sourceFaculty: "Fakultas Informatika",
        sourceCampus: "Universitas Telkom",
        formatType: "LATEX",
        status: "PUBLISHED",
        version: 1,
        isDefault: true,
        numberingConfig: DEFAULT_NUMBERING_CONFIG,
        sections: {
          create: [
            { order: 1, title: "Cover", isOptional: false, guidanceText: "Judul TA, NIM, Nama Mahasiswa, Logo Institusi, Prodi, Fakultas, Tahun." },
            { order: 2, title: "Lembar Persetujuan", isOptional: false, guidanceText: "Persetujuan Dosen Pembimbing 1 & 2." },
            { order: 3, title: "Abstrak", isOptional: false, guidanceText: "Ringkasan Bahasa Indonesia & English (250–350 kata)." },
            { order: 4, title: "BAB I Pendahuluan", isOptional: false, guidanceText: "Latar belakang, rumusan masalah, tujuan, dan manfaat penelitian." },
            { order: 5, title: "BAB II Kajian Pustaka", isOptional: false, guidanceText: "Landasan teori, matriks literatur, dan kerangka konseptual." },
            { order: 6, title: "BAB III Metodologi", isOptional: false, guidanceText: "Alur pemodelan, pengumpulan data, dan pengujian." },
            { order: 7, title: "Daftar Pustaka", isOptional: false, guidanceText: "Format rujukan akademik IEEE / APA." },
            { order: 8, title: "Lampiran", isOptional: true, guidanceText: "Dokumen pelengkap, kuesioner, atau dataset." },
          ],
        },
      },
      include: { variables: true, sections: true },
    });
  }

  // Update variables for FIF template if empty
  if (!fifTemplate.variables || fifTemplate.variables.length === 0) {
    for (const v of TELKOM_FIF_VARIABLES) {
      await prisma.templateVariable.upsert({
        where: {
          templateId_key: {
            templateId: fifTemplate.id,
            key: v.key,
          },
        },
        create: {
          templateId: fifTemplate.id,
          ...v,
        },
        update: {
          ...v,
        },
      });
    }
  }

  // 2. Template General Indonesia (DOCX)
  let generalTemplate = await prisma.proposalTemplate.findFirst({
    where: { formatType: "DOCX", ownerId: null },
    include: { variables: true },
  });

  if (!generalTemplate) {
    generalTemplate = await prisma.proposalTemplate.create({
      data: {
        ownerId: null,
        name: "Proposal Tugas Akhir / Skripsi — Format Umum (DOCX)",
        sourceFaculty: "Umum",
        sourceCampus: "Indonesia",
        formatType: "DOCX",
        status: "PUBLISHED",
        version: 1,
        isDefault: false,
        numberingConfig: DEFAULT_NUMBERING_CONFIG,
        sections: {
          create: [
            { order: 1, title: "Halaman Sampul (Cover)", isOptional: false, guidanceText: "Halaman sampul resmi sesuai panduan penulisan akademik." },
            { order: 2, title: "Halaman Persetujuan", isOptional: false, guidanceText: "Tanda tangan pembimbing dan kaprodi." },
            { order: 3, title: "Abstrak", isOptional: false, guidanceText: "Abstrak dan kata kunci." },
            { order: 4, title: "BAB I PENDAHULUAN", isOptional: false, guidanceText: "Latar Belakang, Rumusan Masalah, Batasan Masalah, Tujuan, dan Manfaat." },
            { order: 5, title: "BAB II TINJAUAN PUSTAKA", isOptional: false, guidanceText: "Penelitian terdahulu, landasan teori, dan hipotesis." },
            { order: 6, title: "BAB III METODOLOGI PENELITIAN", isOptional: false, guidanceText: "Desain penelitian, populasi/sampel, instrumen, dan teknik analisis." },
            { order: 7, title: "DAFTAR PUSTAKA", isOptional: false, guidanceText: "Daftar pustaka berstandar APA 7th atau IEEE." },
            { order: 8, title: "LAMPIRAN", isOptional: true, guidanceText: "Instrumen penelitian dan lembar pendukung." },
          ],
        },
      },
      include: { variables: true },
    });
  }

  if (!generalTemplate.variables || generalTemplate.variables.length === 0) {
    for (const v of GENERAL_DOCX_VARIABLES) {
      await prisma.templateVariable.upsert({
        where: {
          templateId_key: {
            templateId: generalTemplate.id,
            key: v.key,
          },
        },
        create: {
          templateId: generalTemplate.id,
          ...v,
        },
        update: {
          ...v,
        },
      });
    }
  }

  // 3. Auto-link existing projects without templateId to the default FIF template
  await prisma.researchProject.updateMany({
    where: { templateId: null },
    data: {
      templateId: fifTemplate.id,
      templateVersion: 1,
    },
  });

  return {
    seeded: true,
    message: "Template default (Telkom FIF & General DOCX) dan variabel berhasil disinkronisasi",
  };
}
