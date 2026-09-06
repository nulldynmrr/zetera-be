import prisma from "../lib/prisma.js";
import { resolveSubchapterTag } from "./taxonomy.service.js";

export async function getUserProjects(userId) {
  return prisma.researchProject.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          journals: true,
          frameworkNodes: true,
          frameworkEdges: true,
        },
      },
      journals: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectById(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      journals: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  return project;
}

export async function createProject(userId, {
  title,
  description,
  field,
  nama,
  logoUrl,
  prodi,
  kelas,
  approachType,
  approachConfig,
  commonNarrative,
  customOutline,
  citationStyle,
}) {
  return prisma.researchProject.create({
    data: {
      userId,
      title: title || "Proposal Skripsi Baru",
      description: description || null,
      field: field || null,
      nama: nama || null,
      logoUrl: logoUrl || null,
      prodi: prodi || null,
      kelas: kelas || null,
      approachType: approachType || "QUANTITATIVE",
      approachConfig: approachConfig || null,
      commonNarrative: commonNarrative || null,
      customOutline: customOutline || null,
      citationStyle: citationStyle || null,
    },
  });
}

export async function updateProject(projectId, userId, data) {
  await getProjectById(projectId, userId);

  return prisma.researchProject.update({
    where: { id: projectId },
    data,
  });
}

export async function deleteProject(projectId, userId) {
  await getProjectById(projectId, userId);

  return prisma.researchProject.delete({
    where: { id: projectId },
  });
}

import { executeAiCompletion } from "./ai-router.service.js";
import { parseJsonFromText } from "../lib/groq-config.js";
import { updateTocSnapshot } from "./memory.service.js";

// ── Overhaul v2: Custom BAB / Daftar Isi Builder ───────────

export async function getCustomOutline(projectId, userId) {
  const project = await getProjectById(projectId, userId);
  let customOutline = project.customOutline;

  const isValidBabStructure =
    Array.isArray(customOutline) &&
    customOutline.length > 0 &&
    customOutline.some((b) => b && (b.babNumber || b.subChapters));

  // If invalid or missing, auto-reconstruct from existing ResearchOutlineItems in DB
  if (!isValidBabStructure) {
    const outlineItems = await prisma.researchOutlineItem.findMany({
      where: { projectId },
      orderBy: [{ bab: "asc" }, { order: "asc" }],
    });

    if (outlineItems.length > 0) {
      const ROMAN_MAP = { 1: "BAB I", 2: "BAB II", 3: "BAB III", 4: "BAB IV", 5: "BAB V" };
      const DEFAULT_TITLES = {
        1: "Pendahuluan",
        2: "Landasan Teori & Tinjauan Pustaka",
        3: "Metodologi Penelitian",
        4: "Hasil dan Pembahasan",
        5: "Kesimpulan dan Saran",
      };

      const reconstructed = [];
      for (let bNum = 1; bNum <= 5; bNum++) {
        const subs = outlineItems
          .filter((i) => i.bab === bNum)
          .map((i) => ({
            id: i.itemId,
            itemId: i.itemId,
            title: i.title,
            depth: i.depth || 2,
            tag: i.tag || null,
            isCustom: Boolean(i.isCustom),
          }));

        if (subs.length > 0 || bNum <= 3) {
          reconstructed.push({
            babNumber: bNum,
            roman: ROMAN_MAP[bNum] || `BAB ${bNum}`,
            title: DEFAULT_TITLES[bNum] || `BAB ${bNum}`,
            subChapters: subs,
          });
        }
      }

      if (reconstructed.length > 0) {
        customOutline = reconstructed;
        // Auto-heal DB record
        await prisma.researchProject.update({
          where: { id: projectId },
          data: { customOutline },
        }).catch(() => {});
      }
    }
  }

  return {
    projectId: project.id,
    title: project.title,
    prodi: project.prodi,
    approachType: project.approachType,
    customOutline: customOutline || null,
  };
}

export async function saveCustomOutline(projectId, userId, customOutline) {
  const project = await getProjectById(projectId, userId);

  const updated = await prisma.researchProject.update({
    where: { id: projectId },
    data: { customOutline },
  });

  // Sync snapshot ke ProjectMemory dan tabel ResearchOutlineItem di Database
  if (Array.isArray(customOutline)) {
    const flatItems = [];
    let orderCounter = 1;
    customOutline.forEach((bab) => {
      if (Array.isArray(bab.subChapters)) {
        bab.subChapters.forEach((sub) => {
          const babNum = Number(bab.babNumber || bab.number || 1);
          const resolved = resolveSubchapterTag(sub.title || sub.name, sub.itemId || `${babNum}.${orderCounter}`);
          const tagString = typeof sub.tag === "string" ? sub.tag : (resolved?.tag || null);
          flatItems.push({
            itemId: String(sub.itemId || sub.id || `${babNum}.${orderCounter}`),
            title: String(sub.title || sub.name || ""),
            bab: babNum,
            depth: Number(sub.depth || (String(sub.itemId || "").split(".").length || 2)),
            order: orderCounter++,
            tag: tagString,
            isCustom: sub.isCustom !== undefined ? Boolean(sub.isCustom) : Boolean(resolved?.isCustom),
          });
        });
      }
    });

    if (flatItems.length > 0) {
      // 1. Sync ke ProjectMemory
      await updateTocSnapshot(projectId, flatItems).catch((e) => console.warn("Sync TOC to memory failed:", e.message));

      // 2. Sync ke ResearchOutlineItem database table
      const existingItems = await prisma.researchOutlineItem.findMany({
        where: { projectId },
      });
      const existingMap = new Map(existingItems.map((i) => [i.itemId, i]));
      const newIds = new Set(flatItems.map((f) => f.itemId));

      // Hapus yang dibuang oleh user
      const idsToDelete = existingItems.filter((i) => !newIds.has(i.itemId)).map((i) => i.id);
      if (idsToDelete.length > 0) {
        await prisma.researchOutlineItem.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // Upsert / Update sub-chapters
      for (const item of flatItems) {
        const existing = existingMap.get(item.itemId);
        if (existing) {
          await prisma.researchOutlineItem.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              bab: item.bab,
              depth: item.depth,
              order: item.order,
              tag: item.tag || existing.tag,
              isCustom: item.isCustom,
            },
          });
        } else {
          // Buat baru dengan dynamic research task
          const cleanTitle = project.title || "Topik Penelitian";
          await prisma.researchOutlineItem.create({
            data: {
              projectId,
              itemId: item.itemId,
              title: item.title,
              bab: item.bab,
              depth: item.depth,
              order: item.order,
              tag: item.tag,
              isCustom: item.isCustom,
              status: "EMPTY",
              researchTask: {
                what: `Kaji ${item.title} yang terikat secara spesifik pada topik "${cleanTitle}"`,
                why: `Mendukung pembahasan ${item.title} dalam struktur bab ${item.bab}`,
                how: `Kaji literatur akademik dan sumber resmi terkait ${item.title}`,
                bulletInstructions: [
                  {
                    step: `Kaji konsep fundamental, urgensi masalah, atau landasan ${item.title} terkait "${cleanTitle}".`,
                    searchQuery: `${cleanTitle} ${item.title}`,
                  },
                  {
                    step: `Uraikan penjelasan sistematis dan dukungan bukti empiris untuk ${item.title}.`,
                    searchQuery: `${cleanTitle} ${item.title} kajian literatur`,
                  },
                ],
                searchQueries: [`${cleanTitle} ${item.title}`],
                targetEvidence: 2,
                evidenceType: ["jurnal terindeks"],
              },
              evidence: [],
              userNotes: null,
              isLocked: false,
              dependsOn: [],
            },
          });
        }
      }
    }
  }

  return updated;
}

export async function aiSuggestSubchapters({ projectId, userId, babNumber, currentOutline }) {
  const project = await getProjectById(projectId, userId);

  const systemPrompt = `Anda adalah Ahli Kurikulum & Metodologi Skripsi Akademik Indonesia (Zetera AI).
Tugas Anda: Memberikan saran struktur sub-bab (dan sub-sub-bab) yang spesifik, relevan, dan bernas untuk BAB ${babNumber || "I-III"} sesuai judul penelitian skripsi.

Ketentuan:
1. Setiap sub-bab HARUS bernilai akademis tinggi dan relevan dengan topik & metodologi (${project.approachType || "QUANTITATIVE"}).
2. Hindari nama sub-bab yang terlalu umum/kosong. Contoh jika topik "Deteksi Depresi di Twitter dengan BERT", sub-bab BAB II harus menyebut "Arsitektur BERT", "Pemrosesan Teks Bahasa Alami pada Media Sosial", "Karakteristik Linguistik Gejala Depresi".
3. Format output JSON murni:
{
  "subChapters": [
    {
      "itemId": "1.1",
      "title": "Latar Belakang",
      "description": "Fokus fenomena dan urgensi riset"
    }
  ]
}`;

  const userPrompt = `Judul Skripsi: "${project.title}"
Program Studi: "${project.prodi || "Informatika / Sains Data"}"
Pendekatan: "${project.approachType || "QUANTITATIVE"}"
BAB Target: BAB ${babNumber || 1}
Struktur saat ini: ${JSON.stringify(currentOutline || [])}

Berikan rekomendasi 4-7 sub-bab yang ideal untuk BAB ${babNumber || 1} pada skripsi ini.`;

  try {
    const res = await executeAiCompletion({
      featureCode: "OUTLINE_BLUEPRINT",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true,
      userId,
    });

    const parsed = parseJsonFromText(res.content || "");
    if (parsed?.subChapters && Array.isArray(parsed.subChapters)) {
      return parsed.subChapters;
    }
  } catch (err) {
    console.warn("AI suggest sub-chapters error:", err.message);
  }

  // Fallback standar
  return [
    { itemId: `${babNumber}.1`, title: "Sub-bab 1", description: "Deskripsi bahasan" },
    { itemId: `${babNumber}.2`, title: "Sub-bab 2", description: "Deskripsi bahasan" },
    { itemId: `${babNumber}.3`, title: "Sub-bab 3", description: "Deskripsi bahasan" },
  ];
}

