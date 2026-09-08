import { prisma } from "../lib/prisma.js";
import { SUBBAB_DICTIONARY, matchSubBabTag } from "../lib/subbab-dictionary.js";

/**
 * GET /api/subbab
 * List seluruh Sub-bab dengan OutputSpec dan Rule Mappings
 */
export async function getSubBabs(req, res) {
  try {
    const { bab } = req.query;

    const where = {};
    if (bab !== undefined && bab !== "") {
      where.bab = parseInt(bab);
    }

    const subBabs = await prisma.subBab.findMany({
      where,
      include: {
        outputSpec: true,
        mappings: {
          include: {
            rule: {
              include: {
                variants: true,
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ bab: "asc" }, { order: "asc" }],
    });

    const enriched = subBabs.map((s) => {
      const normTag = (s.tag || "").toLowerCase().replace(/[-\s]/g, "_");
      const matchedCanonical = matchSubBabTag(s.tag) || matchSubBabTag(s.title);
      const synonyms =
        SUBBAB_DICTIONARY[normTag] ||
        (matchedCanonical ? SUBBAB_DICTIONARY[matchedCanonical] : []) ||
        [];
      return {
        ...s,
        synonyms,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("[subbab.controller] getSubBabs error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/subbab/:id
 * Detail Sub-bab
 */
export async function getSubBabById(req, res) {
  try {
    const { id } = req.params;

    const subBab = await prisma.subBab.findFirst({
      where: {
        OR: [{ id }, { tag: id }],
      },
      include: {
        outputSpec: true,
        mappings: {
          include: {
            rule: {
              include: { variants: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!subBab) {
      return res.status(404).json({ success: false, message: "Sub-bab tidak ditemukan" });
    }

    return res.json({ success: true, data: subBab });
  } catch (err) {
    console.error("[subbab.controller] getSubBabById error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/subbab
 * Buat Sub-bab baru
 */
export async function createSubBab(req, res) {
  try {
    const { tag, title, bab = 1, order = 0, outputSpec, ruleIds = [] } = req.body;

    if (!tag || !title) {
      return res.status(400).json({ success: false, message: "tag dan title wajib diisi" });
    }

    const cleanTag = tag.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");

    const existing = await prisma.subBab.findUnique({ where: { tag: cleanTag } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Sub-bab dengan tag "${cleanTag}" sudah ada` });
    }

    const subBab = await prisma.subBab.create({
      data: {
        tag: cleanTag,
        title: title.trim(),
        bab: parseInt(bab),
        order: parseInt(order),
        outputSpec: {
          create: {
            formatStyle: outputSpec?.formatStyle || "PARAGRAPH",
            citationPolicy: outputSpec?.citationPolicy || "OPTIONAL",
            renderTemplate: outputSpec?.renderTemplate || null,
            jsonSchema: outputSpec?.jsonSchema || null,
          },
        },
      },
      include: {
        outputSpec: true,
      },
    });

    // Pasang rule mappings jika disertakan
    if (Array.isArray(ruleIds) && ruleIds.length > 0) {
      for (let i = 0; i < ruleIds.length; i++) {
        const rItem = typeof ruleIds[i] === "string" ? { ruleId: ruleIds[i] } : ruleIds[i];
        if (rItem?.ruleId) {
          await prisma.subBabRuleMapping.create({
            data: {
              subBabId: subBab.id,
              ruleId: rItem.ruleId,
              order: rItem.order ?? i + 1,
              isRequired: rItem.isRequired ?? true,
            },
          });
        }
      }
    }

    const result = await prisma.subBab.findUnique({
      where: { id: subBab.id },
      include: {
        outputSpec: true,
        mappings: {
          include: { rule: { include: { variants: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("[subbab.controller] createSubBab error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/subbab/:id
 * Update judul, bab, atau order Sub-bab
 */
export async function updateSubBab(req, res) {
  try {
    const { id } = req.params;
    const { title, bab, order } = req.body;

    const existing = await prisma.subBab.findFirst({
      where: { OR: [{ id }, { tag: id }] },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Sub-bab tidak ditemukan" });
    }

    const updated = await prisma.subBab.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(bab !== undefined && { bab: parseInt(bab) }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
      include: {
        outputSpec: true,
        mappings: {
          include: { rule: { include: { variants: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[subbab.controller] updateSubBab error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/subbab/:id
 * Hapus Sub-bab
 */
export async function deleteSubBab(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.subBab.findFirst({
      where: { OR: [{ id }, { tag: id }] },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Sub-bab tidak ditemukan" });
    }

    await prisma.subBab.delete({
      where: { id: existing.id },
    });

    return res.json({ success: true, message: `Sub-bab "${existing.title}" berhasil dihapus` });
  } catch (err) {
    console.error("[subbab.controller] deleteSubBab error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/subbab/:id/rules
 * Simpan/Ganti mapping Rules untuk sub-bab ini (N:N Mapping)
 * Body: { rules: [ { ruleId: string, order?: number, isRequired?: boolean } ] }
 */
export async function setRuleMappings(req, res) {
  try {
    const { id } = req.params;
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, message: "rules harus berupa array" });
    }

    const subBab = await prisma.subBab.findFirst({
      where: { OR: [{ id }, { tag: id }] },
    });

    if (!subBab) {
      return res.status(404).json({ success: false, message: "Sub-bab tidak ditemukan" });
    }

    // Hapus seluruh mapping lama
    await prisma.subBabRuleMapping.deleteMany({
      where: { subBabId: subBab.id },
    });

    // Buat mapping baru
    for (let i = 0; i < rules.length; i++) {
      const r = typeof rules[i] === "string" ? { ruleId: rules[i] } : rules[i];
      if (r?.ruleId) {
        await prisma.subBabRuleMapping.create({
          data: {
            subBabId: subBab.id,
            ruleId: r.ruleId,
            order: r.order ?? i + 1,
            isRequired: r.isRequired ?? true,
          },
        });
      }
    }

    const updated = await prisma.subBab.findUnique({
      where: { id: subBab.id },
      include: {
        outputSpec: true,
        mappings: {
          include: { rule: { include: { variants: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[subbab.controller] setRuleMappings error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/subbab/:id/output-spec
 * Update konfigurasi OutputSpec (formatStyle, citationPolicy, renderTemplate)
 */
export async function updateOutputSpec(req, res) {
  try {
    const { id } = req.params;
    const { formatStyle, citationPolicy, renderTemplate, jsonSchema } = req.body;

    const subBab = await prisma.subBab.findFirst({
      where: { OR: [{ id }, { tag: id }] },
    });

    if (!subBab) {
      return res.status(404).json({ success: false, message: "Sub-bab tidak ditemukan" });
    }

    const spec = await prisma.outputSpec.upsert({
      where: { subBabId: subBab.id },
      update: {
        ...(formatStyle !== undefined && { formatStyle }),
        ...(citationPolicy !== undefined && { citationPolicy }),
        ...(renderTemplate !== undefined && { renderTemplate }),
        ...(jsonSchema !== undefined && { jsonSchema }),
      },
      create: {
        subBabId: subBab.id,
        formatStyle: formatStyle || "PARAGRAPH",
        citationPolicy: citationPolicy || "OPTIONAL",
        renderTemplate: renderTemplate || null,
        jsonSchema: jsonSchema || null,
      },
    });

    return res.json({ success: true, data: spec });
  } catch (err) {
    console.error("[subbab.controller] updateOutputSpec error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
