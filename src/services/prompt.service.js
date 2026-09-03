import prisma from "../lib/prisma.js";

// In-memory cache for ultra-fast lookup (TTL 30 detik)
const cache = new Map();
const CACHE_TTL = 30 * 1000;

/**
 * 1. Ambil prompt skill berdasarkan kode (dengan fallback ke default)
 */
export async function getSkillPrompt(code, variables = {}) {
  const cached = cache.get(code);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return interpolatePrompt(cached.data, variables);
  }

  try {
    const promptRecord = await prisma.aiSkillPrompt.findUnique({
      where: { code, isActive: true },
    });

    if (promptRecord) {
      cache.set(code, { data: promptRecord, timestamp: now });
      return interpolatePrompt(promptRecord, variables);
    }
  } catch (err) {
    console.warn(`[prompt.service] Failed to fetch prompt "${code}" from DB:`, err.message);
  }

  return null;
}

/**
 * 2. Ambil semua modeling guide sub-bab dari database
 */
export async function getAllSubchapterGuides() {
  const cached = cache.get("__ALL_SUBCHAPTER_GUIDES__");
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const guides = await prisma.aiSkillPrompt.findMany({
      where: { category: "SUBCHAPTER", isActive: true },
    });

    if (guides && guides.length > 0) {
      const guideMap = {};
      for (const g of guides) {
        // e.g. "SUBCHAPTER_1_1" => key "1.1"
        const subCode = g.code.replace("SUBCHAPTER_", "").replace(/_/g, ".");
        guideMap[subCode] = {
          name: g.title.replace(/^BAB \d+\.\d+:?\s*/i, ""),
          steps: Array.isArray(g.recipeSteps) ? g.recipeSteps : [],
          systemPrompt: g.systemPrompt,
          tags: g.tags || [],
        };
      }
      cache.set("__ALL_SUBCHAPTER_GUIDES__", { data: guideMap, timestamp: now });
      return guideMap;
    }
  } catch (err) {
    console.warn("[prompt.service] Failed to fetch subchapter guides from DB:", err.message);
  }

  return null;
}

/**
 * 3. List prompt library dengan filter kategori & search
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

  if (tag) {
    return prompts.filter((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      return tags.some((t) => String(t).toLowerCase().includes(tag.toLowerCase()));
    });
  }

  return prompts;
}

/**
 * 4. Create new Skill Prompt
 */
export async function createSkillPrompt(data) {
  const created = await prisma.aiSkillPrompt.create({
    data: {
      code: data.code.toUpperCase().replace(/\s+/g, "_"),
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

  cache.clear();
  return created;
}

/**
 * 5. Update Skill Prompt
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

  cache.clear();
  return updated;
}

/**
 * 6. Delete Skill Prompt
 */
export async function deleteSkillPrompt(idOrCode) {
  const existing = await prisma.aiSkillPrompt.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
  });

  if (!existing) throw new Error("Skill Prompt tidak ditemukan");
  if (existing.isSystem) throw new Error("Prompt sistem bawaan tidak dapat dihapus (gunakan edit atau nonaktifkan)");

  await prisma.aiSkillPrompt.delete({ where: { id: existing.id } });
  cache.clear();
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
