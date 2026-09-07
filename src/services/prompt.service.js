import prisma from "../lib/prisma.js";
import { SUBCHAPTER_TAXONOMY, invalidatePromptDbCache } from "./taxonomy.service.js";
import { getSubchapterSpecByCode } from "../subchapters/index.js";

// In-memory cache for ultra-fast lookup (TTL 5 menit)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 0. Invalidate in-memory prompt cache
 */
export function invalidatePromptCache(tag = null, scope = null) {
  invalidatePromptDbCache();
  if (!tag && !scope) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (scope && tag && key === `PROMPT:${scope}:${tag}`) {
      cache.delete(key);
    } else if (tag && key.includes(`:${tag}`)) {
      cache.delete(key);
    } else if (scope && key.includes(`PROMPT:${scope}:`)) {
      cache.delete(key);
    }
  }
}

/**
 * 1. Resolve Prompt Template by semantic tag and scope (Prompt-as-Data runtime)
 * Fallback to '__generic__' if custom subchapter, then fallback to default taxonomy.
 */
export async function resolvePrompt(tag, scope = "subchapter", variables = {}) {
  const cacheKey = `PROMPT:${scope}:${tag || "__generic__"}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return interpolatePrompt(cached.data, variables);
  }

  try {
    // 1. Cari exact match (tag, scope, isActive)
    let template = null;
    if (tag) {
      template = await prisma.promptTemplate.findFirst({
        where: { tag, scope, isActive: true },
        orderBy: { version: "desc" },
      });
    }

    // 2. Fallback ke '__generic__' jika scope subchapter dan tag tidak ditemukan
    if (!template && scope === "subchapter") {
      template = await prisma.promptTemplate.findFirst({
        where: { tag: "__generic__", scope: "subchapter", isActive: true },
        orderBy: { version: "desc" },
      });
    }

    // 3. Fallback ke AiSkillPrompt atau taxonomy jika belum ada di PromptTemplate
    if (!template && tag && SUBCHAPTER_TAXONOMY[tag]) {
      const tax = SUBCHAPTER_TAXONOMY[tag];
      template = {
        tag,
        scope: "subchapter",
        label: `Resep Standar: ${tax.defaultTitle}`,
        systemPrompt: `Anda adalah Metodolog Skripsi Ahli. Rancang butir riset terikat topik {{TOPIC}} untuk sub-bab ${tax.defaultTitle}.`,
        userPromptTemplate: null,
        steps: (tax.defaultRecipeSteps || []).map((s, idx) => ({ order: idx + 1, instruction: s })),
        modelTier: "paid",
        version: 1,
        isActive: true,
      };
    }

    if (template) {
      // Normalisasi format steps agar selalu array of string atau objects
      const normalizedSteps = Array.isArray(template.steps)
        ? template.steps.map((st) => (typeof st === "string" ? st : st.instruction || st.step || ""))
        : [];

      const enriched = {
        ...template,
        stepStrings: normalizedSteps,
      };

      cache.set(cacheKey, { data: enriched, timestamp: now });
      return interpolatePrompt(enriched, variables);
    }
  } catch (err) {
    console.warn(`[prompt.service] Failed to resolve prompt for (${tag}, ${scope}):`, err.message);
  }

  return null;
}

/**
 * 2. Save / Version Prompt Template (Edit Prompt with versioning)
 */
export async function savePromptTemplate({
  tag,
  scope = "subchapter",
  label,
  description = "",
  systemPrompt = "",
  userPromptTemplate = null,
  steps = [],
  modelTier = "paid",
  createdBy = "system",
}) {
  if (!tag) throw new Error("Tag wajib diisi untuk menyimpan PromptTemplate");

  // Cari versi tertinggi saat ini
  const latest = await prisma.promptTemplate.findFirst({
    where: { tag, scope },
    orderBy: { version: "desc" },
  });

  const nextVersion = latest ? latest.version + 1 : 1;

  // Nonaktifkan versi-versi lama
  await prisma.promptTemplate.updateMany({
    where: { tag, scope, isActive: true },
    data: { isActive: false },
  });

  // Buat versi baru aktif
  const newTemplate = await prisma.promptTemplate.create({
    data: {
      tag,
      scope,
      label: label || `Prompt ${tag}`,
      description,
      systemPrompt,
      userPromptTemplate,
      steps: Array.isArray(steps) ? steps : [],
      modelTier,
      version: nextVersion,
      isActive: true,
      createdBy,
    },
  });

  // Hapus cache seketika
  invalidatePromptCache(tag, scope);

  return newTemplate;
}

/**
 * 3. Ambil prompt skill berdasarkan kode (backward compatible)
 */
export async function getSkillPrompt(code, variables = {}) {
  const cached = cache.get(`CODE:${code}`);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return interpolatePrompt(cached.data, variables);
  }

  try {
    const promptRecord = await prisma.aiSkillPrompt.findUnique({
      where: { code, isActive: true },
    });

    if (promptRecord) {
      cache.set(`CODE:${code}`, { data: promptRecord, timestamp: now });
      return interpolatePrompt(promptRecord, variables);
    }
  } catch (err) {
    console.warn(`[prompt.service] Failed to fetch prompt "${code}" from DB:`, err.message);
  }

  return null;
}

/**
 * 4. Ambil semua modeling guide sub-bab dari database
 * Mendukung lookup berdasarkan tag (misal: 'latar_belakang') MAUPUN nomor (misal: '1.1')
 */
export async function getAllSubchapterGuides() {
  const cached = cache.get("__ALL_SUBCHAPTER_GUIDES__");
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // 1. Baca dari PromptTemplate table
    const templates = await prisma.promptTemplate.findMany({
      where: { scope: "subchapter", isActive: true },
    });

    const guideMap = {};

    if (templates && templates.length > 0) {
      for (const t of templates) {
        const stepStrings = Array.isArray(t.steps)
          ? t.steps.map((s) => (typeof s === "string" ? s : s.instruction || s.step || ""))
          : [];

        const guideObj = {
          name: t.label,
          steps: stepStrings,
          systemPrompt: t.systemPrompt,
          tag: t.tag,
        };

        // Simpan by tag
        guideMap[t.tag] = guideObj;

        // Simpan juga by subCode (misal 1.1) jika tag ada di taksonomi
        if (SUBCHAPTER_TAXONOMY[t.tag]) {
          const tax = SUBCHAPTER_TAXONOMY[t.tag];
          const standardAlias = tax.aliases.find((a) => /^\d+\.\d+$/.test(a));
          if (standardAlias) {
            guideMap[standardAlias] = guideObj;
          }
        }
      }
    }

    // 2. Baca juga dari AiSkillPrompt untuk kompatibilitas penuh
    const legacyGuides = await prisma.aiSkillPrompt.findMany({
      where: { category: "SUBCHAPTER", isActive: true },
    });

    for (const g of legacyGuides) {
      const subCode = g.code.replace("SUBCHAPTER_", "").replace(/_/g, ".");
      if (!guideMap[subCode]) {
        guideMap[subCode] = {
          name: g.title.replace(/^BAB \d+\.\d+:?\s*/i, ""),
          steps: Array.isArray(g.recipeSteps) ? g.recipeSteps : [],
          systemPrompt: g.systemPrompt,
          tags: g.tags || [],
        };
      }
    }

    cache.set("__ALL_SUBCHAPTER_GUIDES__", { data: guideMap, timestamp: now });
    return guideMap;
  } catch (err) {
    console.warn("[prompt.service] Failed to fetch subchapter guides from DB:", err.message);
  }

  return null;
}

/**
 * 5. List prompt library dengan filter kategori & search
 */
export async function listSkillPrompts({ category, tag, search, activeOnly = false }) {
  const where = {};
  if (category) where.category = category;
  if (activeOnly) where.isActive = true;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const prompts = await prisma.aiSkillPrompt.findMany({
    where,
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  let finalPrompts = prompts;
  if (tag) {
    finalPrompts = prompts.filter((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      return tags.some((t) => String(t).toLowerCase().includes(tag.toLowerCase()));
    });
  }

  // Enrich with modular subchapter specs (rules & paper preview examples)
  return finalPrompts.map((p) => {
    const spec = getSubchapterSpecByCode(p.code);
    return {
      ...p,
      paperRules: spec?.paper?.rules || null,
      previewExample: spec?.paper?.previewExample || null,
      slug: spec?.slug || null,
    };
  });
}

/**
 * 6. Create new Skill Prompt
 */
export async function createSkillPrompt(data) {
  const code = data.code.toUpperCase().replace(/\s+/g, "_");
  const created = await prisma.aiSkillPrompt.create({
    data: {
      code,
      title: data.title,
      category: data.category || "CUSTOM",
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || "",
      systemPrompt: data.systemPrompt || "",
      userPromptTemplate: data.userPromptTemplate || null,
      recipeSteps: Array.isArray(data.recipeSteps) ? data.recipeSteps : [],
      isSystem: false,
      isActive: data.isActive !== false,
      version: 1,
    },
  });

  // Sinkronkan ke PromptTemplate jika relevan
  const inferredTag = (Array.isArray(data.tags) && data.tags[0]) || code.toLowerCase();
  await savePromptTemplate({
    tag: inferredTag,
    scope: data.category === "SUBCHAPTER" ? "subchapter" : "feature",
    label: data.title,
    description: data.description,
    systemPrompt: data.systemPrompt,
    userPromptTemplate: data.userPromptTemplate,
    steps: Array.isArray(data.recipeSteps) ? data.recipeSteps.map((s, idx) => ({ order: idx + 1, instruction: s })) : [],
    createdBy: "admin",
  }).catch(() => {});

  invalidatePromptCache();
  return created;
}

/**
 * 7. Update Skill Prompt (Auto-versioning)
 */
export async function updateSkillPrompt(idOrCode, data) {
  const existing = await prisma.aiSkillPrompt.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
  });

  if (!existing) throw new Error("Skill Prompt tidak ditemukan");

  const updated = await prisma.aiSkillPrompt.update({
    where: { id: existing.id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.tags !== undefined && { tags: Array.isArray(data.tags) ? data.tags : [] }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
      ...(data.userPromptTemplate !== undefined && { userPromptTemplate: data.userPromptTemplate }),
      ...(data.recipeSteps !== undefined && { recipeSteps: Array.isArray(data.recipeSteps) ? data.recipeSteps : [] }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      version: { increment: 1 },
    },
  });

  // Sinkronkan ke PromptTemplate table
  const inferredTag = (Array.isArray(updated.tags) && updated.tags.find(t => SUBCHAPTER_TAXONOMY[t])) ||
    updated.code.toLowerCase().replace(/^subchapter_|^skill_/, "").replace(/\./g, "_");

  await savePromptTemplate({
    tag: inferredTag,
    scope: updated.category === "SUBCHAPTER" ? "subchapter" : "feature",
    label: updated.title,
    description: updated.description || "",
    systemPrompt: updated.systemPrompt,
    userPromptTemplate: updated.userPromptTemplate,
    steps: Array.isArray(updated.recipeSteps) ? updated.recipeSteps.map((s, idx) => ({ order: idx + 1, instruction: s })) : [],
    createdBy: "admin",
  }).catch((err) => {
    console.warn("[prompt.service] Sync to PromptTemplate on update error:", err.message);
  });

  invalidatePromptCache();
  return updated;
}

/**
 * 8. Delete Skill Prompt
 */
export async function deleteSkillPrompt(idOrCode) {
  const existing = await prisma.aiSkillPrompt.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
  });

  if (!existing) throw new Error("Skill Prompt tidak ditemukan");
  if (existing.isSystem) throw new Error("Prompt sistem bawaan tidak dapat dihapus (gunakan edit atau nonaktifkan)");

  await prisma.aiSkillPrompt.delete({ where: { id: existing.id } });
  invalidatePromptCache();
  return { success: true, message: "Prompt berhasil dihapus" };
}

/**
 * Helper: Interpolasi variabel template
 */
function interpolatePrompt(promptRecord, variables = {}) {
  let systemPrompt = promptRecord.systemPrompt || "";
  let userTemplate = promptRecord.userPromptTemplate || "";

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    systemPrompt = systemPrompt.replace(regex, typeof value === "object" ? JSON.stringify(value) : String(value));
    userTemplate = userTemplate.replace(regex, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  return {
    ...promptRecord,
    renderedSystemPrompt: systemPrompt,
    renderedUserPrompt: userTemplate,
  };
}
