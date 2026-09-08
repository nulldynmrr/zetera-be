import { prisma } from "../lib/prisma.js";

/**
 * GET /api/rules
 * List seluruh Rule dengan filter kategori, pencarian, dan hitungan relasi
 */
export async function getRules(req, res) {
  try {
    const { category, search, activeOnly } = req.query;

    const where = {};
    if (category) where.category = category;
    if (activeOnly === "true") where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
        { systemPrompt: { contains: search } },
      ];
    }

    const rules = await prisma.rule.findMany({
      where,
      include: {
        variants: {
          orderBy: { researchApproach: "asc" },
        },
        _count: {
          select: { mappings: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return res.json({ success: true, data: rules });
  } catch (err) {
    console.error("[rules.controller] getRules error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/rules/:id
 * Detail Rule berdasarkan ID atau slug
 */
export async function getRuleById(req, res) {
  try {
    const { id } = req.params;

    const rule = await prisma.rule.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        variants: true,
        mappings: {
          include: {
            subBab: {
              include: { outputSpec: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule tidak ditemukan" });
    }

    return res.json({ success: true, data: rule });
  } catch (err) {
    console.error("[rules.controller] getRuleById error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/rules
 * Buat Rule baru
 */
export async function createRule(req, res) {
  try {
    const { slug, name, category = "WRITING_STYLE", description, systemPrompt, isActive = true } = req.body;

    if (!slug || !name || !systemPrompt) {
      return res.status(400).json({
        success: false,
        message: "slug, name, dan systemPrompt wajib diisi",
      });
    }

    const cleanSlug = slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");

    const existing = await prisma.rule.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Rule dengan slug "${cleanSlug}" sudah ada` });
    }

    const rule = await prisma.rule.create({
      data: {
        slug: cleanSlug,
        name: name.trim(),
        category,
        description: description?.trim() || null,
        systemPrompt,
        isActive: Boolean(isActive),
        isSystem: false,
      },
      include: {
        variants: true,
      },
    });

    return res.status(201).json({ success: true, data: rule });
  } catch (err) {
    console.error("[rules.controller] createRule error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/rules/:id
 * Update data Rule
 */
export async function updateRule(req, res) {
  try {
    const { id } = req.params;
    const { name, category, description, systemPrompt, isActive } = req.body;

    const existing = await prisma.rule.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Rule tidak ditemukan" });
    }

    const updated = await prisma.rule.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: {
        variants: true,
        _count: { select: { mappings: true } },
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[rules.controller] updateRule error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/rules/:id
 * Hapus Rule
 */
export async function deleteRule(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.rule.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Rule tidak ditemukan" });
    }

    await prisma.rule.delete({
      where: { id: existing.id },
    });

    return res.json({ success: true, message: `Rule "${existing.name}" berhasil dihapus` });
  } catch (err) {
    console.error("[rules.controller] deleteRule error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/rules/:id/variants
 * Buat atau update varian pendekatan riset untuk suatu Rule
 */
export async function upsertVariant(req, res) {
  try {
    const { id } = req.params;
    const { researchApproach, systemPrompt } = req.body;

    if (!researchApproach || !systemPrompt) {
      return res.status(400).json({
        success: false,
        message: "researchApproach dan systemPrompt wajib diisi",
      });
    }

    const rule = await prisma.rule.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule tidak ditemukan" });
    }

    const approach = researchApproach.toUpperCase().trim();

    const variant = await prisma.ruleVariant.upsert({
      where: {
        ruleId_researchApproach: {
          ruleId: rule.id,
          researchApproach: approach,
        },
      },
      update: {
        systemPrompt,
      },
      create: {
        ruleId: rule.id,
        researchApproach: approach,
        systemPrompt,
      },
    });

    return res.json({ success: true, data: variant });
  } catch (err) {
    console.error("[rules.controller] upsertVariant error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/rules/:id/variants/:variantId
 * Hapus varian pendekatan riset
 */
export async function deleteVariant(req, res) {
  try {
    const { id, variantId } = req.params;

    const rule = await prisma.rule.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Rule tidak ditemukan" });
    }

    await prisma.ruleVariant.delete({
      where: { id: variantId },
    });

    return res.json({ success: true, message: "Varian berhasil dihapus" });
  } catch (err) {
    console.error("[rules.controller] deleteVariant error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
