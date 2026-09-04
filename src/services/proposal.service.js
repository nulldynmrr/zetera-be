import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { prisma } from "../lib/prisma.js";
import { executeAiCompletion } from "./ai-router.service.js";
import { getMaiarouterChatCompletion } from "./maiarouter.service.js";
import { getGroqChatCompletion, GROQ_MODELS, parseJsonFromText } from "../lib/groq-config.js";
import { generateFrameworkFromJournals } from "./framework.service.js";
import { buildMemoryContext, updateWriterDecisions } from "./memory.service.js";
import { getSkillPrompt } from "./prompt.service.js";
import { formatBibliography, formatInTextCitation } from "../lib/citation-engine.js";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
} from "docx";

/**
 * 1. Ambil Data Proposal Lengkap (Profil Kampus + Kanvas Node + Jurnal Pendukung)
 */
export async function getProposalData(projectId, userId) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      frameworkNodes: {
        include: {
          nodeMappings: {
            include: {
              journal: true,
            },
          },
          sourceEdges: true,
          targetEdges: true,
        },
      },
      frameworkEdges: {
        include: {
          sourceNode: true,
          targetNode: true,
        },
      },
      journals: {
        where: { status: "APPROVED" },
        include: {
          nodeMappings: true,
        },
      },
      template: {
        include: {
          sections: { orderBy: { order: "asc" } },
          variables: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  // Ambil profil mahasiswa & kampus dari UserProfile
  const userProfile = userId
    ? await prisma.userProfile.findUnique({
        where: { userId },
      })
    : null;

  // Ambil Outline Blueprint & Evidence yang sudah dikumpulkan pengguna
  const outlineItems = await prisma.researchOutlineItem.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });

  // Susun matriks literature review dari jurnal approved (Fase 2)
  const literatureMatrix = (project.journals || []).map((j) => {
    const mappedNodes = (j.nodeMappings || [])
      .map((m) => {
        const node = project.frameworkNodes.find((n) => n.id === m.nodeId);
        return node ? `${node.label} (${m.evidenceType === "SUPPORTS" ? "Mendukung" : "Bertentangan"})` : null;
      })
      .filter(Boolean);

    return {
      id: j.id,
      title: j.title,
      authors: j.authors || "Penulis",
      year: j.year || new Date().getFullYear(),
      publication: j.publication || "Jurnal Ilmiah",
      doi: j.doi || "-",
      methodology: j.rawExtraction?.methodology || "Kuantitatif / Kualitatif",
      sampleSize: j.rawExtraction?.sampleSize || "-",
      keyFindings: j.keyFindings || j.abstract?.slice(0, 250) || "Temuan empiris terkait fokus penelitian.",
      mappedVariables: mappedNodes.join(", ") || "Variabel Terkait",
      quotes: (j.nodeMappings || []).map((m) => ({
        quote: m.quote,
        page: m.sourcePage || 1,
        evidenceType: m.evidenceType,
      })),
    };
  });

  // Gabungkan dengan Evidence Jurnal dari Research Blueprint (Tahap 5)
  outlineItems.forEach((item) => {
    if (Array.isArray(item.evidence)) {
      item.evidence.forEach((ev) => {
        if (ev && ev.title && !literatureMatrix.some((m) => m.title.toLowerCase() === ev.title.toLowerCase() || (m.id && m.id === ev.id))) {
          const rawPub = ev.publication || ev.venue || "";
          const cleanPublication = rawPub
            .replace(/\s*\(OpenAlex\)/gi, "")
            .replace(/OpenAlex/gi, "Jurnal Ilmiah Terindeks")
            .trim() || (ev.doi ? "Jurnal Ilmiah Nasional Terakreditasi" : "Publikasi Ilmiah Akademik");

          literatureMatrix.push({
            id: ev.id || `ev-${Math.random()}`,
            title: ev.title,
            authors: ev.authors || "Penulis",
            year: ev.year || new Date().getFullYear(),
            publication: cleanPublication,
            doi: ev.doi || "-",
            methodology: "Studi Empiris",
            sampleSize: "-",
            keyFindings: ev.abstract?.slice(0, 300) || `Bukti empiris rujukan sub-bab ${item.itemId} (${item.title})`,
            mappedVariables: `${item.itemId} ${item.title}`,
            quotes: [],
          });
        }
      });
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const profile = {
    namaLengkap: userProfile?.namaLengkap || user?.name || project.nama || "Mahasiswa Peneliti",
    nim: userProfile?.nim || "",
    universitas: userProfile?.universitas || "",
    fakultas: userProfile?.fakultas || "",
    programStudi: userProfile?.programStudi || project.prodi || "",
    kota: userProfile?.kota || "",
    logoUrl: userProfile?.logoUrl || project.logoUrl || null,
  };

  return {
    project,
    profile,
    literatureMatrix,
    outlineItems,
    savedDraft: project.commonNarrative?.proposalDraft || null,
  };
}

/**
 * 2. Simpan Data Draf & Editan Naskah Proposal ke Database (MySQL)
 */
export async function saveProposalData(projectId, userId, draftData = {}) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const existingNarrative =
    project.commonNarrative && typeof project.commonNarrative === "object"
      ? project.commonNarrative
      : {};

  const updatedNarrative = {
    ...existingNarrative,
    proposalDraft: {
      ...draftData,
      lastSavedAt: new Date().toISOString(),
    },
  };

  const updateData = {
    commonNarrative: updatedNarrative,
    customOutline: draftData.customSubChapters || project.customOutline,
  };

  if (draftData.variableValues) {
    updateData.variableValues = draftData.variableValues;
  }
  if (draftData.templateId) {
    updateData.templateId = draftData.templateId;
  }
  if (draftData.coverData?.logoUrl) {
    updateData.logoUrl = draftData.coverData.logoUrl;
  }

  const updatedProject = await prisma.researchProject.update({
    where: { id: projectId },
    data: updateData,
  });

  return {
    projectId,
    lastSavedAt: updatedNarrative.proposalDraft.lastSavedAt,
    savedDraft: updatedNarrative.proposalDraft,
  };
}

/**
 * 3. Generate Proposal Skripsi Lengkap AI (Bab 1, Bab 2, Bab 3, Matriks, Daftar Pustaka)
 */
export async function generateAcademicProposal(projectId, userId, options = {}) {
  const data = await getProposalData(projectId, userId);
  const { project, profile, literatureMatrix, outlineItems } = data;

  const nodesSummary = (project.frameworkNodes || [])
    .map(
      (n) =>
        `- [${n.type}] "${n.label}": ${n.description || "Komponen kerangka berpikir"}.`
    )
    .join("\n");

  const edgesSummary = (project.frameworkEdges || [])
    .map(
      (e) =>
        `- "${e.sourceNode?.label}" ➔ "${e.targetNode?.label}" (Relasi: ${e.relationshipLabel || "Mempengaruhi"})`
    )
    .join("\n");

  // Rangkuman Evidence Jurnal dari Research Blueprint
  const journalsSummary = (literatureMatrix || [])
    .map(
      (j, idx) =>
        `[${idx + 1}] "${j.title}" oleh ${j.authors} (${j.year}) ${j.doi && j.doi !== "-" ? `[DOI: ${j.doi}]` : ""}\n   Fokus: ${j.mappedVariables}\n   Temuan/Abstrak: ${j.keyFindings}`
    )
    .join("\n\n");

  const itemLatarBelakang = (outlineItems || []).find((i) => i.itemId === "1.1");
  const userLatarBelakang = itemLatarBelakang?.userNotes?.trim();

  // Rangkuman Blueprint Outline
  const outlineSummary = (outlineItems || [])
    .map(
      (item) =>
        `- Sub-bab ${item.itemId} (${item.title}): WHAT: ${item.researchTask?.what || "-"} | WHY: ${item.researchTask?.why || "-"} | Catatan User: ${item.userNotes || "-"}`
    )
    .join("\n");

  const citationStyle = project.citationStyle || "IEEE";

  // Ambil system prompt dari Library Prompt Database (PROPOSAL_FULL_SYNTHESIS_SYSTEM)
  const dbSkillPrompt = await getSkillPrompt("PROPOSAL_FULL_SYNTHESIS_SYSTEM", {
    TITLE: project.title,
    FIELD: project.field || project.prodi || "Akademik",
    CITATION_STYLE: citationStyle,
  });

  const systemPrompt = dbSkillPrompt?.systemPrompt || `## PERAN
Anda adalah Penulis Akademik Indonesia Berpengalaman & Metodolog Penelitian Skripsi (Zetera AI).
Tugas Anda adalah mensintesis seluruh Research Blueprint dan Jurnal Evidence yang telah dikumpulkan mahasiswa menjadi NASKAH PROPOSAL SKRIPSI LENGKAP yang spesifik, ilmiah, mendalam, dan anti-template generik.
Tulisan Anda mengikuti kaidah penulisan jurnal ilmiah terindeks SINTA, bukan terjemahan literal, dan bebas dari pola mekanis generative AI.

## KARAKTERISTIK GAYA BAHASA YANG HARUS DIPAKAI:
1. Bahasa baku sesuai PUEBI / EYD V — tanpa singkatan informal atau kata tidak baku.
2. Kalimat pasif proporsional — memakai konstruksi pasif ilmiah ("dilakukan", "ditemukan", "diperoleh", "dianalisis", "diukur").
3. Kutipan teks WAJIB mengikuti format gaya sitasi proyek (${citationStyle}): ${citationStyle === "IEEE" || citationStyle === "VANCOUVER" ? "menggunakan nomor rujukan numerik [1], [2], [3]" : "menggunakan format nama dan tahun (Penulis, Tahun)"} yang merujuk langsung ke DAFTAR JURNAL REFERENSI EMPIRIS yang diberikan.
4. Kepadatan argumen — setiap paragraf memiliki satu ide pokok yang dikembangkan dengan bukti data dan telaah rujukan nyata.
5. Variasi panjang kalimat — padukan kalimat kompleks bertingkat dengan kalimat pendek tegas agar ritme mengalir alami.
6. Terminologi disiplin ilmu yang presisi sesuai topik ("${project.title}").

## POLA YANG HARUS DIHINDARI (CIRI KHAS TULISAN AI):
- HINDARI frasa klise pembuka: "Dalam era globalisasi saat ini...", "Tidak dapat dipungkiri bahwa...", "Seiring perkembangan teknologi...". Langsung masuk ke fakta, konteks masalah, dan data empiris.
- HINDARI transisi mekanis yang berulang di setiap paragraf ("selain itu", "di sisi lain", "dengan demikian", "oleh karena itu").
- HINDARI struktur simetris kaku (selalu 3 poin, 3 alasan, 3 dampak). Variasikan secara alami.
- HINDARI kata penguat generik ("krusial", "esensial", "sangat penting") tanpa didukung data.
- HINDARI hedging berlebih ("dapat dikatakan bahwa", "tampaknya"). Nyatakan temuan secara lugas dan terukur.
- HINDARI tanda baca em dash (—) berlebih atau tanda kurung repetitif. Gunakan anak kalimat penjelas yang wajar.

## INTEGRITAS ILMIAH:
1. Jika mahasiswa telah menyusun draf naskah pada Outline (seperti 1.1 Latar Belakang), WAJIB pertahankan dan kembangkan argumentasi asli mahasiswa tersebut.
2. Setiap rumusan masalah, tujuan, dan metodologi harus spesifik pada topik "${project.title}".`;

  const userPrompt = `SINTESISKAN PROPOSAL TUGAS AKHIR BERIKUT:
- Judul Skripsi: "${project.title}"
- Bidang Kajian: "${project.field || project.prodi || "Teknik Informatika"}"
- Pendekatan Riset: "${project.approachType || "QUANTITATIVE"}"
- Mahasiswa: ${profile.namaLengkap} (NIM: ${profile.nim})
- Program Studi: ${profile.programStudi}, ${profile.fakultas}, ${profile.universitas}
${userLatarBelakang ? `\n📌 DRAF ASLI MAHASISWA DARI OUTLINE (1.1 LATAR BELAKANG):\n"${userLatarBelakang}"\n(Instruksi Khusus: Pertahankan argumen, data rujukan, dan kembangkan secara utuh ke dalam bab1.latarBelakang)` : ""}

STRUKTUR RESEARCH BLUEPRINT MAHASISWA:
${outlineSummary || "- Outline standar Bab 1-3"}

ELEMEN KANVAS KERANGKA & VARIABEL:
${nodesSummary || "- Belum ada node graf"}
${edgesSummary ? `HUBUNGAN VARIABEL:\n${edgesSummary}` : ""}

DAFTAR JURNAL EVIDENCE EMPIRIS YANG SUDAH DIKUMPULKAN (${literatureMatrix.length} Artikel):
${journalsSummary || "- Belum ada jurnal rujukan"}

FORMAT OUTPUT WAJIB JSON MURNI TANPA WRAPPER MARKDOWN:
{
  "cover": {
    "title": "${project.title}",
    "author": "${profile.namaLengkap}",
    "nim": "${profile.nim}",
    "prodi": "${profile.programStudi}",
    "fakultas": "${profile.fakultas}",
    "universitas": "${profile.universitas}",
    "year": "${new Date().getFullYear()}"
  },
  "abstract": {
    "indo": "Ringkasan komprehensif latar belakang, metode, dan kontribusi penelitian dalam bahasa Indonesia (200-250 kata)...",
    "eng": "English abstract translation of the research summary...",
    "keywordsIndo": "kata kunci 1, kata kunci 2, kata kunci 3",
    "keywordsEng": "keyword 1, keyword 2, keyword 3"
  },
  "bab1": {
    "latarBelakang": "Uraian latar belakang masalah yang sangat mendalam (4-6 paragraf) menghubungkan fenomena dunia nyata, urgensi digitalisasi, dan mengutip jurnal evidence di atas menggunakan sitasi IEEE [1], [2], dst...",
    "identifikasiMasalah": [
      "Poin identifikasi masalah 1...",
      "Poin identifikasi masalah 2...",
      "Poin identifikasi masalah 3..."
    ],
    "rumusanMasalah": [
      "1. Pertanyaan penelitian spesifik 1...",
      "2. Pertanyaan penelitian spesifik 2..."
    ],
    "tujuanPenelitian": [
      "1. Tujuan penelitian spesifik 1...",
      "2. Tujuan penelitian spesifik 2..."
    ],
    "manfaatPenelitian": {
      "teoretis": "Uraian kontribusi teoretis akademis...",
      "praktis": "Uraian manfaat praktis aplikatif..."
    }
  },
  "bab2": {
    "tinjauanPustaka": "Kajian komprehensif penelitian terdahulu yang merujuk pada jurnal evidence di atas dengan sitasi [1], [2]...",
    "landasanTeori": "Uraian teori fundamental, metode teknis, algoritma, dan evaluasi terkait...",
    "kerangkaKonseptual": "Penjelasan alur logis kerangka pemikiran...",
    "hipotesis": [
      "H1: Hipotesis spesifik 1...",
      "H2: Hipotesis spesifik 2..."
    ]
  },
  "bab3": {
    "subjekObjek": "Penjelasan subjek dan objek data penelitian...",
    "alatBahan": "Spesifikasi perangkat keras, perangkat lunak, dan dataset...",
    "diagramAlur": "Tahapan metodologi dari pengumpulan data, preprocessing, pemodelan, hingga pengujian...",
    "desainPenelitian": "Pendekatan kuantitatif / kualitatif asosiatif...",
    "populasiSampel": "Target populasi, sampel, dan teknik pengambilan data...",
    "teknikPengumpulanData": "Teknik scraping, dataset, kuesioner, atau observasi...",
    "teknikAnalisisData": "Metode analisis dan evaluasi (Akurasi, F1-Score, atau Uji Hipotesis)..."
  },
  "daftarPustaka": [
    "Daftar pustaka berurutan [1], [2] sesuai urutan sitasi IEEE untuk semua artikel evidence..."
  ]
}
`;

  // Eksekusi via Central AI Router Engine (Feature: DRAFT_SKRIPSI)
  try {
    const aiResponse = await executeAiCompletion({
      featureCode: "DRAFT_SKRIPSI",
      userId,
      projectId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 3800,
    });

    const contentText = aiResponse.content;
    if (contentText) {
      const parsed = parseJsonFromText(contentText);
      if (parsed.bab1 && parsed.bab2) {
        const resultData = {
          ...parsed,
          literatureMatrix,
        };
        // Auto-save to database draft
        await saveProposalData(projectId, userId, {
          proposalData: parsed,
          coverData: parsed.cover || { title: project.title, author: profile.namaLengkap, nim: profile.nim, prodi: profile.programStudi, fakultas: profile.fakultas, universitas: profile.universitas, year: `${new Date().getFullYear()}` },
          abstractData: parsed.abstract || null,
          references: literatureMatrix,
        }).catch((err) => console.warn("[Proposal] Auto-save draft failed:", err.message));

        // Otomatis sinkronkan dan bangun Framework Nodes di database (agar tidak perlu kerja 2x)
        generateFrameworkFromJournals(projectId, userId).catch((err) =>
          console.warn("[Proposal] Framework auto-sync note:", err.message)
        );

        return {
          success: true,
          data: resultData,
        };
      }
    }
  } catch (routerErr) {
    console.warn("[Proposal] AI Router failed, trying direct Groq fallback:", routerErr.message);
  }

  // Fallback ke Groq SDK
  try {
    const groqRes = await getGroqChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: GROQ_MODELS.DEEP_REASON,
      temperature: 0.2,
      maxTokens: 3500,
    });

    const contentText = groqRes.choices[0]?.message?.content;
    if (contentText) {
      const parsed = parseJsonFromText(contentText);
      if (parsed.bab1) {
        const resultData = {
          ...parsed,
          literatureMatrix,
        };
        // Auto-save to database draft
        await saveProposalData(projectId, userId, {
          proposalData: parsed,
          coverData: parsed.cover || null,
          abstractData: parsed.abstract || null,
          references: literatureMatrix,
        }).catch((err) => console.warn("[Proposal] Auto-save draft failed:", err.message));

        return {
          success: true,
          data: resultData,
        };
      }
    }
  } catch (gErr) {
    console.warn("Groq call failed, generating deterministic template:", gErr.message);
  }

  // Fallback deterministik cerdas berbasis Node & Jurnal
  const findOutlineNotes = (itemId) => {
    const it = (outlineItems || []).find((i) => i.itemId === itemId);
    return it?.userNotes?.trim() || null;
  };

  const item1_1 = findOutlineNotes("1.1");
  const item1_2 = findOutlineNotes("1.2");
  const item1_3 = findOutlineNotes("1.3");
  const item1_4 = findOutlineNotes("1.4");
  const item2_1 = findOutlineNotes("2.1");
  const item2_3 = findOutlineNotes("2.3");
  const item3_1 = findOutlineNotes("3.1");
  const item3_2 = findOutlineNotes("3.2");
  const item3_3 = findOutlineNotes("3.3");
  const item3_4 = findOutlineNotes("3.4");

  return {
    success: true,
    data: {
      cover: {
        title: project.title,
        author: profile.namaLengkap,
        nim: profile.nim,
        prodi: profile.programStudi,
        fakultas: profile.fakultas,
        universitas: profile.universitas,
        year: `${new Date().getFullYear()}`,
      },
      bab1: {
        latarBelakang: item1_1 || "",
        identifikasiMasalah: [],
        rumusanMasalah: item1_2 ? item1_2.split(/\n+/).filter(Boolean) : [],
        tujuanPenelitian: item1_3 ? item1_3.split(/\n+/).filter(Boolean) : [],
        manfaatPenelitian: {
          teoretis: item1_4 || "",
          praktis: "",
        },
      },
      bab2: {
        landasanTeori: item2_1 || "",
        kerangkaKonseptual: item2_3 || "",
        hipotesis: project.frameworkEdges.length > 0
          ? project.frameworkEdges.map((e, idx) => `H${idx + 1}: Terdapat relasi "${e.relationshipLabel || "pengaruh positif"}" antara ${e.sourceNode?.label} terhadap ${e.targetNode?.label}.`)
          : [],
      },
      bab3: {
        desainPenelitian: item3_1 || "",
        populasiSampel: item3_2 || "",
        teknikPengumpulanData: item3_3 || "",
        teknikAnalisisData: item3_4 || "",
      },
      daftarPustaka: literatureMatrix.map((j, idx) => formatBibliography(j, citationStyle, idx + 1)),
      literatureMatrix,
    },
  };
}

function formatApa7thCitation(j) {
  const author = j.authors || "Penulis";
  const year = j.year || "n.d.";
  const title = j.title || "Judul Sumber";
  const pub = j.publication || j.venue || "";
  const doi = j.doi && j.doi !== "-" ? (j.doi.startsWith("http") ? j.doi : `https://doi.org/${j.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}`) : null;
  const url = j.url && j.url !== "-" ? j.url : null;
  const type = (j.sourceType || "").toUpperCase();

  if (type === "BUKU" || type === "BOOK") {
    return `${author} (${year}). ${title}. ${pub ? `${pub}.` : ""}`.trim();
  }
  if (type === "LAPORAN_RESMI" || type === "REPORT" || type === "UU") {
    return `${author} (${year}). ${title}. ${pub ? `${pub}.` : ""}`.trim();
  }
  if (type === "WEBSITE" || type === "WEB") {
    return `${author} (${year}). ${title}. Diakses dari ${url || pub}`.trim();
  }
  if (doi) {
    return `${author} (${year}). ${title}. ${pub ? `${pub}. ` : ""}${doi}`.trim();
  }
  if (url) {
    return `${author} (${year}). ${title}. ${pub ? `${pub}. ` : ""}${url}`.trim();
  }
  return `${author} (${year}). ${title}. ${pub ? `${pub}.` : ""}`.trim();
}

/**
 * 3. Ekspor Dokumen Resmi DOCX Format Proposal Skripsi Indonesia
 */
export async function exportProposalDocxFile(projectId, userId) {
  const proposalDataFromDb = await getProposalData(projectId, userId);
  const savedDraft = proposalDataFromDb.savedDraft;

  let data;
  if (savedDraft?.proposalData) {
    data = {
      ...savedDraft.proposalData,
      literatureMatrix: proposalDataFromDb.literatureMatrix,
    };
  } else {
    const proposalRes = await generateAcademicProposal(projectId, userId);
    data = proposalRes.data;
  }

  const customSubs = savedDraft?.customSubChapters || [];
  const approval = savedDraft?.approvalData || null;
  const abstract = savedDraft?.abstractData || null;
  const appendix = savedDraft?.appendixData || null;

  const tableHeaderRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ text: "No", alignment: AlignmentType.CENTER, run: { bold: true, size: 20 } })],
        width: { size: 6, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "Penulis & Tahun", alignment: AlignmentType.CENTER, run: { bold: true, size: 20 } })],
        width: { size: 22, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "Judul Artikel & Publikasi", alignment: AlignmentType.CENTER, run: { bold: true, size: 20 } })],
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "Variabel & Metode", alignment: AlignmentType.CENTER, run: { bold: true, size: 20 } })],
        width: { size: 20, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "Temuan Utama / Bukti", alignment: AlignmentType.CENTER, run: { bold: true, size: 20 } })],
        width: { size: 22, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const tableDataRows = (data.literatureMatrix || []).map((j, i) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: `${i + 1}`, alignment: AlignmentType.CENTER, run: { size: 19 } })] }),
        new TableCell({ children: [new Paragraph({ text: `${j.authors} (${j.year})`, run: { size: 19 } })] }),
        new TableCell({ children: [new Paragraph({ text: `${j.title}\n[${j.publication}]`, run: { size: 19 } })] }),
        new TableCell({ children: [new Paragraph({ text: `${j.mappedVariables}\n(${j.methodology})`, run: { size: 19 } })] }),
        new TableCell({ children: [new Paragraph({ text: j.keyFindings, run: { size: 19 } })] }),
      ],
    })
  );

  // Helper paragraph builder
  const createBodyParagraph = (text, isFirstLineIndent = true) => {
    return new Paragraph({
      children: [new TextRun({ text: text || "", size: 24, font: "Times New Roman" })],
      alignment: AlignmentType.JUSTIFIED,
      indent: isFirstLineIndent ? { firstLine: 720 } : undefined, // 1.27cm indent
      spacing: { line: 360, before: 60, after: 120 }, // 1.5 spasi
    });
  };

  const createHeading1 = (text, withPageBreak = true) => {
    return new Paragraph({
      children: [new TextRun({ text: text, bold: true, size: 28, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: withPageBreak,
      spacing: { before: 240, after: 200 },
    });
  };

  const createHeading2 = (text) => {
    return new Paragraph({
      children: [new TextRun({ text: text, bold: true, size: 24, font: "Times New Roman" })],
      alignment: AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
    });
  };

  const docChildren = [
    // ── HALAMAN SAMPUL / COVER ──
    new Paragraph({
      children: [new TextRun({ text: "PROPOSAL PENELITIAN TUGAS AKHIR", bold: true, size: 28, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.cover.title.toUpperCase(), bold: true, size: 26, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 800 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Disusun Oleh:\n", size: 24, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.cover.author.toUpperCase(), bold: true, size: 26, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `NIM: ${data.cover.nim}`, bold: true, size: 24, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 800 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `PROGRAM STUDI SARJANA ${data.cover.prodi.toUpperCase()}\nFAKULTAS ${data.cover.fakultas.toUpperCase()}\n${data.cover.universitas.toUpperCase()}\nBANDUNG\n${data.cover.year}`,
          bold: true,
          size: 24,
          font: "Times New Roman",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
    }),
  ];

  // ── LEMBAR PERSETUJUAN (JIKA ADA) ──
  if (approval) {
    docChildren.push(
      createHeading1("LEMBAR PERSETUJUAN", true),
      new Paragraph({
        children: [new TextRun({ text: data.cover.title, bold: true, size: 24, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: approval.titleEng || `A Research Proposal on ${data.cover.title}`, italics: true, size: 22, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
      }),
      createBodyParagraph(`Proposal ini diajukan sebagai usulan resmi pembuatan Tugas Akhir pada Program Studi Sarjana ${data.cover.prodi}, Fakultas ${data.cover.fakultas}, ${data.cover.universitas}.`),
      new Paragraph({
        children: [new TextRun({ text: `Bandung, ${approval.dateDay} ${approval.dateMonth} ${approval.dateYear}\nMenyetujui,`, size: 24, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Calon Pembimbing 1:\t\t\tCalon Pembimbing 2:\n\n\n\n${approval.pembimbing1}\t\t\t${approval.pembimbing2}\nNIP: ${approval.nipPembimbing1}\t\tNIP: ${approval.nipPembimbing2}`, size: 22, font: "Times New Roman" }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Mengetahui,\nKetua Program Studi Sarjana ${data.cover.prodi}\n\n\n\n${approval.kaprodi}\nNIP: ${approval.nipKaprodi}`, size: 22, font: "Times New Roman" }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      })
    );
  }

  // ── ABSTRAK (JIKA ADA) ──
  if (abstract) {
    docChildren.push(
      createHeading1("ABSTRAK", true),
      createBodyParagraph(abstract.indo || "Abstrak naskah proposal penelitian..."),
      new Paragraph({
        children: [
          new TextRun({ text: "Kata Kunci: ", bold: true, size: 24, font: "Times New Roman" }),
          new TextRun({ text: abstract.keywordsIndo || `${data.cover.prodi}, metodologi riset`, italics: true, size: 24, font: "Times New Roman" }),
        ],
        spacing: { before: 100, after: 240 },
      })
    );
  }

  // ── BAB I: PENDAHULUAN ──
  docChildren.push(
    createHeading1("BAB I\nPENDAHULUAN", true),
    createHeading2("1.1 Latar Belakang Masalah"),
    createBodyParagraph(data.bab1.latarBelakang),
    createHeading2("1.2 Rumusan Masalah"),
    ...(data.bab1.rumusanMasalah || []).map((r) => createBodyParagraph(r, false)),
    createHeading2("1.3 Tujuan Penelitian"),
    ...(data.bab1.tujuanPenelitian || []).map((t) => createBodyParagraph(t, false)),
    createHeading2("1.4 Manfaat Penelitian"),
    createBodyParagraph(`1.4.1 Manfaat Teoretis: ${data.bab1.manfaatPenelitian?.teoretis || "Kontribusi teoritis..."}`),
    createBodyParagraph(`1.4.2 Manfaat Praktis: ${data.bab1.manfaatPenelitian?.praktis || "Kontribusi praktis..."}`)
  );

  // Custom sub-chapters for Bab 1
  customSubs
    .filter((s) => s.chapter === "bab1" && !s.hidden)
    .forEach((s) => {
      docChildren.push(createHeading2(s.title), createBodyParagraph(s.content));
    });

  // ── BAB II: TINJAUAN PUSTAKA & MATRIKS ──
  docChildren.push(
    createHeading1("BAB II\nTINJAUAN PUSTAKA & KERANGKA PEMIKIRAN", true),
    createHeading2("2.1 Landasan Teori & Variabel Riset"),
    createBodyParagraph(data.bab2.landasanTeori),
    createHeading2("2.2 Matriks Penelitian Terdahulu (State of the Art)"),
    new Table({
      rows: [tableHeaderRow, ...tableDataRows],
    }),
    createHeading2("2.3 Kerangka Konseptual"),
    createBodyParagraph(data.bab2.kerangkaKonseptual),
    createHeading2("2.4 Hipotesis Penelitian"),
    ...(data.bab2.hipotesis || []).map((h) => createBodyParagraph(h, false))
  );

  // Custom sub-chapters for Bab 2
  customSubs
    .filter((s) => s.chapter === "bab2" && !s.hidden)
    .forEach((s) => {
      docChildren.push(createHeading2(s.title), createBodyParagraph(s.content));
    });

  // ── BAB III: METODOLOGI PENELITIAN ──
  docChildren.push(
    createHeading1("BAB III\nMETODOLOGI PENELITIAN", true),
    createHeading2("3.1 Desain Penelitian"),
    createBodyParagraph(data.bab3.desainPenelitian),
    createHeading2("3.2 Populasi dan Sampel"),
    createBodyParagraph(data.bab3.populasiSampel),
    createHeading2("3.3 Teknik Pengumpulan Data"),
    createBodyParagraph(data.bab3.teknikPengumpulanData),
    createHeading2("3.4 Teknik Analisis Data"),
    createBodyParagraph(data.bab3.teknikAnalisisData)
  );

  // Custom sub-chapters for Bab 3
  customSubs
    .filter((s) => s.chapter === "bab3" && !s.hidden)
    .forEach((s) => {
      docChildren.push(createHeading2(s.title), createBodyParagraph(s.content));
    });

  // ── DAFTAR PUSTAKA ──
  const docxCitationStyle = (proposalDataFromDb.project?.citationStyle || "IEEE").toUpperCase();
  const bibliographyItems = (data.daftarPustaka && data.daftarPustaka.length > 0)
    ? data.daftarPustaka
    : (data.literatureMatrix || []).map((j, idx) => formatBibliography(j, docxCitationStyle, idx + 1));
  const isNumericCitation = docxCitationStyle === "IEEE" || docxCitationStyle === "VANCOUVER";

  docChildren.push(
    createHeading1("DAFTAR PUSTAKA", true),
    ...bibliographyItems.map((p) => {
      return new Paragraph({
        children: [new TextRun({ text: p, size: 24, font: "Times New Roman" })],
        alignment: AlignmentType.JUSTIFIED,
        indent: isNumericCitation ? { left: 0 } : { left: 720, hanging: 720 }, // APA/Harvard hanging indent
        spacing: { line: 360, before: 60, after: 120 },
      });
    })
  );

  // ── LAMPIRAN (JIKA ADA) ──
  if (appendix) {
    docChildren.push(
      createHeading1("LAMPIRAN", true),
      createHeading2(appendix.title),
      createBodyParagraph(appendix.content, false)
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24, // 12pt
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 Paper (210 x 297 mm)
            margin: {
              top: 2268, // 4 cm
              left: 2268, // 4 cm
              bottom: 1701, // 3 cm
              right: 1701, // 3 cm
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ─────────────────────────────────────────────────────────────
// 4. Ekspor Bundle LaTeX Siap Overleaf (.ZIP) per Sub-bab
// ─────────────────────────────────────────────────────────────
export async function exportProposalLatexZipFile(projectId, userId, templateType = "TELKOM_FIF") {
  const proposalDataFromDb = await getProposalData(projectId, userId);
  let data;
  if (proposalDataFromDb.savedDraft?.proposalData) {
    data = {
      ...proposalDataFromDb.savedDraft.proposalData,
      literatureMatrix: proposalDataFromDb.literatureMatrix,
    };
  } else {
    const proposalRes = await generateAcademicProposal(projectId, userId);
    data = proposalRes.data;
  }

  const zip = new JSZip();

  // Bersihkan karakter khusus LaTeX
  const escapeLatex = (str) =>
    (str || "")
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([&%$#_{}])/g, "\\$1")
      .replace(/~/g, "\\textasciitilde{}")
      .replace(/\^/g, "\\textasciicircum{}");

  if (templateType === "TELKOM_FIF") {
    const templateDir = path.resolve("src/templates/latex/Template Proposal FIF_Latex (1)");

    // 1. Cover & Main Config
    let mainContent = "";
    if (fs.existsSync(path.join(templateDir, "main.tex"))) {
      mainContent = fs.readFileSync(path.join(templateDir, "main.tex"), "utf-8");
      mainContent = mainContent
        .replace(/\\title\{.*?\}/, `\\title{${escapeLatex(data.cover.title)}}`)
        .replace(/\\author\{.*?\}/, `\\author{${escapeLatex(data.cover.author)}}`)
        .replace(/\\newcommand\{\\NIM\}\{.*?\}/, `\\newcommand{\\NIM}{${escapeLatex(data.cover.nim)}}`)
        .replace(/\\newcommand\{\\Prodi\}\{.*?\}/, `\\newcommand{\\Prodi}{${escapeLatex(data.cover.prodi)}}`);

      if (!mainContent.includes("\\input{zetera-vars}")) {
        mainContent = mainContent.replace("\\input{Cover}", "\\input{zetera-vars}\n\\input{Cover}");
      }
    } else {
      mainContent = `\\documentclass[a4paper,12pt,oneside]{book}\n\\input{zetera-vars}\n\\begin{document}\n\\input{Cover}\n\\input{Pendahuluan}\n\\input{Kajian-Pustaka}\n\\input{Metodologi}\n\\bibliography{References}\n\\end{document}`;
    }
    zip.file("main.tex", mainContent);

    // Dynamic zetera-vars.tex generator (PRD 013 §7.1)
    const varsContent = `%% ====================================================================
%% ZETERA ACADEMIC ENGINE - AUTO GENERATED VARIABLES (DO NOT EDIT MANUALLY)
%% Generated: ${new Date().toISOString()} | Project ID: ${projectId}
%% ====================================================================

\\title{${escapeLatex(data.cover.title)}}\\let\\Title\\@title
\\newcommand{\\EngTitle}{${escapeLatex(data.cover.engTitle || data.cover.title)}}
\\author{${escapeLatex(data.cover.author)}}\\let\\Author\\@author
\\newcommand{\\NIM}{${escapeLatex(data.cover.nim)}}
\\newcommand{\\Prodi}{${escapeLatex(data.cover.prodi)}}
\\newcommand{\\Fakultas}{${escapeLatex(data.cover.fakultas)}}
\\newcommand{\\Universitas}{${escapeLatex(data.cover.universitas)}}
\\newcommand{\\Date}{${escapeLatex(data.cover.year || new Date().getFullYear())}}
\\newcommand{\\PembimbingSatu}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.pembimbing1 || data.approval?.pembimbing1 || "(Pembimbing 1)")}}
\\newcommand{\\NIPPembimbingSatu}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.nipPembimbing1 || data.approval?.nipPembimbing1 || "-")}}
\\newcommand{\\PembimbingDua}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.pembimbing2 || data.approval?.pembimbing2 || "(Pembimbing 2)")}}
\\newcommand{\\NIPPembimbingDua}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.nipPembimbing2 || data.approval?.nipPembimbing2 || "-")}}
\\newcommand{\\Kaprodi}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.kaprodi || data.approval?.kaprodi || "Dr. Erwin Budi Setiawan, S.Si., M.T.")}}
\\newcommand{\\NIPKaprodi}{${escapeLatex(proposalDataFromDb.savedDraft?.approvalData?.nipKaprodi || data.approval?.nipKaprodi || "00760045")}}
`;
    zip.file("zetera-vars.tex", varsContent);

    // 2. Cover.tex
    let coverContent = "";
    if (fs.existsSync(path.join(templateDir, "Cover.tex"))) {
      coverContent = fs.readFileSync(path.join(templateDir, "Cover.tex"), "utf-8");
    } else {
      coverContent = `{\\centering \\large {\\bf \\Title}\\\\ \\vspace{2cm} \\textbf{\\Author}\\\\ \\textbf{\\NIM}\\\\ \\vfill \\textbf{Universitas Telkom}\\\\ \\textbf{\\Date}\\\\}`;
    }
    zip.file("Cover.tex", coverContent);

    // 3. Bab 1: Pendahuluan.tex
    const pendahuluanContent = `\\chapter{Pendahuluan}

\\section{Latar Belakang}
${data.bab1.latarBelakang}

\\section{Perumusan Masalah}
Berdasarkan latar belakang di atas, rumusan masalah dalam penelitian ini adalah:
\\begin{enumerate}
${data.bab1.rumusanMasalah.map((r) => `  \\item ${escapeLatex(r.replace(/^\d+\.\s*/, ""))}`).join("\n")}
\\end{enumerate}

\\section{Tujuan}
Tujuan yang ingin dicapai dalam penelitian ini adalah:
\\begin{enumerate}
${data.bab1.tujuanPenelitian.map((t) => `  \\item ${escapeLatex(t.replace(/^\d+\.\s*/, ""))}`).join("\n")}
\\end{enumerate}

\\section{Manfaat Penelitian}
\\subsection{Manfaat Teoretis}
${escapeLatex(data.bab1.manfaatPenelitian.teoretis)}

\\subsection{Manfaat Praktis}
${escapeLatex(data.bab1.manfaatPenelitian.praktis)}
`;
    zip.file("Pendahuluan.tex", pendahuluanContent);

    // 4. Bab 2: Kajian-Pustaka.tex
    const matrixRowsLatex = (data.literatureMatrix || [])
      .map(
        (j, i) =>
          `${i + 1} & ${escapeLatex(j.authors)} (${j.year}) & ${escapeLatex(j.title)} & ${escapeLatex(j.mappedVariables)} (${escapeLatex(j.methodology)}) & ${escapeLatex(j.keyFindings)} \\\\ \\hline`
      )
      .join("\n");

    const kajianPustakaContent = `\\chapter{Kajian Pustaka dan Kerangka Berpikir}

\\section{Landasan Teori}
${data.bab2.landasanTeori}

\\section{Penelitian Terdahulu (State of the Art)}
Berikut adalah tabel matriks telaah pustaka komparatif penelitian terdahulu:

\\begin{table}[htbp]
  \\centering
  \\small
  \\caption{Matriks Penelitian Terdahulu}
  \\label{tab:penelitian_terdahulu}
  \\begin{tabularx}{\\textwidth}{|c|X|X|X|X|}
    \\hline
    \\textbf{No} & \\textbf{Penulis \\& Tahun} & \\textbf{Judul \\& Publikasi} & \\textbf{Variabel \\& Metode} & \\textbf{Temuan Utama} \\\\
    \\hline
${matrixRowsLatex}
  \\end{tabularx}
\\end{table}

\\section{Kerangka Konseptual}
${data.bab2.kerangkaKonseptual}

\\section{Hipotesis Penelitian}
\\begin{enumerate}
${data.bab2.hipotesis.map((h) => `  \\item ${escapeLatex(h)}`).join("\n")}
\\end{enumerate}
`;
    zip.file("Kajian-Pustaka.tex", kajianPustakaContent);

    // 5. Bab 3: Metodologi.tex
    const metodologiContent = `\\chapter{Metodologi Penelitian}

\\section{Desain Penelitian}
${escapeLatex(data.bab3.desainPenelitian)}

\\section{Populasi dan Sampel}
${escapeLatex(data.bab3.populasiSampel)}

\\section{Teknik Pengumpulan Data}
${escapeLatex(data.bab3.teknikPengumpulanData)}

\\section{Teknik Analisis Data}
${escapeLatex(data.bab3.teknikAnalisisData)}
`;
    zip.file("Metodologi.tex", metodologiContent);

    // 6. References.bib
    const bibtexEntries = (data.literatureMatrix || [])
      .map((j, i) => {
        const citeKey = `ref_${j.year || 2026}_${i + 1}`;
        return `@article{${citeKey},
  author    = {${j.authors}},
  title     = {{${j.title}}},
  journal   = {${j.publication}},
  year      = {${j.year || 2026}},
  doi       = {${j.doi || ""}}
}`;
      })
      .join("\n\n");

    zip.file("References.bib", bibtexEntries);

    // Copy berkas statis (Lembar Persetujuan, Abstrak, Lampiran) jika ada
    const otherFiles = ["Lembar-Persetujuan.tex", "Abstrak-Indo.tex", "Lampiran.tex"];
    for (const f of otherFiles) {
      const fPath = path.join(templateDir, f);
      if (fs.existsSync(fPath)) {
        const fileData = fs.readFileSync(fPath);
        zip.file(f, fileData);
      }
    }

    // Dynamic In-Place Logo Swap (PRD 013 §7.1 & §12)
    let logoSwapped = false;
    const customLogo =
      proposalDataFromDb.project?.variableValues?.LOGO ||
      proposalDataFromDb.project?.logoUrl ||
      proposalDataFromDb.profile?.logoUrl;

    if (customLogo) {
      try {
        if (typeof customLogo === "string" && customLogo.startsWith("data:image/")) {
          const b64Data = customLogo.replace(/^data:image\/\w+;base64,/, "");
          zip.file("Tel-U-Logo.png", Buffer.from(b64Data, "base64"));
          logoSwapped = true;
        } else if (typeof customLogo === "string" && (customLogo.startsWith("http://") || customLogo.startsWith("https://"))) {
          const res = await fetch(customLogo);
          if (res.ok) {
            const ab = await res.arrayBuffer();
            zip.file("Tel-U-Logo.png", Buffer.from(ab));
            logoSwapped = true;
          }
        } else if (typeof customLogo === "string") {
          const cleanPath = customLogo.replace(/^[/\\]+/, "");
          const absPath = path.resolve(cleanPath);
          if (fs.existsSync(absPath)) {
            zip.file("Tel-U-Logo.png", fs.readFileSync(absPath));
            logoSwapped = true;
          }
        }
      } catch (err) {
        console.warn("Logo swap fallback warning:", err.message);
      }
    }

    if (!logoSwapped) {
      const defaultLogoPath = path.join(templateDir, "Tel-U-Logo.png");
      if (fs.existsSync(defaultLogoPath)) {
        zip.file("Tel-U-Logo.png", fs.readFileSync(defaultLogoPath));
      }
    }
  } else {
    // Master General LaTeX Template Standar Skripsi Indonesia
    const masterTexPath = path.resolve("src/templates/latex/proposal_skripsi_id.tex");
    let masterTex = fs.existsSync(masterTexPath)
      ? fs.readFileSync(masterTexPath, "utf-8")
      : "";

    const matrixRowsLatex = (data.literatureMatrix || [])
      .map(
        (j, i) =>
          `${i + 1} & ${escapeLatex(j.authors)} (${j.year}) & ${escapeLatex(j.title)} & ${escapeLatex(j.mappedVariables)} & ${escapeLatex(j.keyFindings)} \\\\ \\hline`
      )
      .join("\n");

    masterTex = masterTex
      .replace(/\{\{PROJECT_TITLE\}\}/g, escapeLatex(data.cover.title))
      .replace(/\{\{STUDENT_NAME\}\}/g, escapeLatex(data.cover.author))
      .replace(/\{\{STUDENT_NIM\}\}/g, escapeLatex(data.cover.nim))
      .replace(/\{\{STUDENT_PRODI\}\}/g, escapeLatex(data.cover.prodi))
      .replace(/\{\{STUDENT_FACULTY\}\}/g, escapeLatex(data.cover.fakultas))
      .replace(/\{\{STUDENT_UNIVERSITY\}\}/g, escapeLatex(data.cover.universitas))
      .replace(/\{\{STUDENT_YEAR\}\}/g, escapeLatex(data.cover.year))
      .replace(/\{\{BAB1_LATAR_BELAKANG\}\}/g, data.bab1.latarBelakang)
      .replace(/\{\{BAB1_RUMUSAN_MASALAH\}\}/g, `\\begin{enumerate}\n${data.bab1.rumusanMasalah.map((r) => `  \\item ${escapeLatex(r.replace(/^\d+\.\s*/, ""))}`).join("\n")}\n\\end{enumerate}`)
      .replace(/\{\{BAB1_TUJUAN_PENELITIAN\}\}/g, `\\begin{enumerate}\n${data.bab1.tujuanPenelitian.map((t) => `  \\item ${escapeLatex(t.replace(/^\d+\.\s*/, ""))}`).join("\n")}\n\\end{enumerate}`)
      .replace(/\{\{BAB1_MANFAAT_TEORETIS\}\}/g, escapeLatex(data.bab1.manfaatPenelitian.teoretis))
      .replace(/\{\{BAB1_MANFAAT_PRAKTIS\}\}/g, escapeLatex(data.bab1.manfaatPenelitian.praktis))
      .replace(/\{\{BAB2_LANDASAN_TEORI\}\}/g, data.bab2.landasanTeori)
      .replace(/\{\{BAB2_TABEL_MATRIKS_ROWS\}\}/g, matrixRowsLatex)
      .replace(/\{\{BAB2_KERANGKA_KONSEPTUAL\}\}/g, data.bab2.kerangkaKonseptual)
      .replace(/\{\{BAB2_HIPOTESIS\}\}/g, `\\begin{enumerate}\n${data.bab2.hipotesis.map((h) => `  \\item ${escapeLatex(h)}`).join("\n")}\n\\end{enumerate}`)
      .replace(/\{\{BAB3_DESAIN_PENELITIAN\}\}/g, escapeLatex(data.bab3.desainPenelitian))
      .replace(/\{\{BAB3_POPULASI_SAMPEL\}\}/g, escapeLatex(data.bab3.populasiSampel))
      .replace(/\{\{BAB3_TEKNIK_PENGUMPULAN_DATA\}\}/g, escapeLatex(data.bab3.teknikPengumpulanData))
      .replace(/\{\{BAB3_TEKNIK_ANALISIS_DATA\}\}/g, escapeLatex(data.bab3.teknikAnalisisData))
      .replace(/\{\{DAFTAR_PUSTAKA_ITEMS\}\}/g, data.daftarPustaka.map((p) => `\\noindent ${escapeLatex(p)}\\\\`).join("\n\n"));

    zip.file("main.tex", masterTex);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return zipBuffer;
}

// ── Overhaul v2: Contextual Chat AI Editor ─────────────────
/**
 * Chat kontekstual yang terhubung ke memory project.
 * Hanya mengirim section yang ditargetkan (bukan seluruh proposal dokumen)
 * sehingga sangat hemat biaya dan token, serta presisi.
 */
export async function chatWithProposal(projectId, userId, { sectionId, command, currentContent, conversationHistory = [] }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
    include: {
      journals: {
        where: { status: "APPROVED", tier: { not: "EXCLUDED" } },
        select: { id: true, title: true, authors: true, year: true, doi: true, keyFindings: true },
      },
      outlineItems: {
        where: { itemId: sectionId || undefined },
      },
    },
  });

  if (!project) {
    const err = new Error("Project tidak ditemukan");
    err.statusCode = 404;
    throw err;
  }

  const memoryContext = await buildMemoryContext(projectId).catch(() => "");
  const targetItem = project.outlineItems?.[0] || null;

  const relevantJournals = (project.journals || []).slice(0, 8);
  const journalRefText = relevantJournals
    .map((j) => `- [${j.doi || j.id}] ${j.authors} (${j.year}): "${j.title}" — Temuan: ${j.keyFindings?.slice(0, 150) || "-"}`)
    .join("\n");

  const systemPrompt = `Anda adalah AI Academic Co-Writer & Editor Naskah Skripsi Berpengalaman (Zetera AI).
Tugas Anda: Membantu mahasiswa menyempurnakan, memperbaiki, menambahkan sitasi, atau menyelesaikan catatan TODO pada naskah proposal skripsi.

PRINSIP PENULISAN:
1. Menulis dengan bahasa akademik formal, baku (EYD/PUEBI), bernas, dan terstruktur.
2. JANGAN mengarang sitasi/fakta sembarangan. Gunakan daftar jurnal pool yang tersedia di bawah jika membutuhkan bukti empiris.
3. Fokus revisi HANYA pada bagian/paragraf yang diminta oleh pengguna.
4. Format output WAJIB JSON murni:
{
  "revisedContent": "Teks naskah yang sudah diperbaiki / disempurnakan / diisi TODO-nya secara lengkap",
  "explanation": "Penjelasan singkat (1-2 kalimat) perubahan apa yang dilakukan",
  "usedCitations": ["DOI/Judul jurnal yang disitir jika ada"]
}

${memoryContext}

POOL JURNAL VALID PROYEK INI:
${journalRefText || "(Belum ada jurnal approved di pool)"}`;

  const userPrompt = `FOKUS SECTION: ${sectionId || "Naskah Proposal"} ${targetItem ? `(${targetItem.title})` : ""}
INSTRUKSI PENELITIAN (Outline Task): ${JSON.stringify(targetItem?.researchTask || {})}

TEKS SAAT INI:
"""
${currentContent || "<TODO: Belum ada draf>"}
"""

PERINTAH MAHASISWA:
"${command}"

Eksekusi perintah di atas dan kembalikan teks hasil revisi beserta penjelasannya.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: "user", content: userPrompt },
  ];

  try {
    const res = await executeAiCompletion({
      featureCode: "DRAFT_SKRIPSI",
      messages,
      temperature: 0.3,
      maxTokens: 3500,
      jsonMode: true,
      userId,
      projectId,
    });

    const parsed = parseJsonFromText(res.content || "");
    const revisedContent = parsed?.revisedContent || res.content;
    const explanation = parsed?.explanation || "Teks telah diperbarui sesuai instruksi.";

    // Simpan ringkasan keputusan AI Writer ke memory
    await updateWriterDecisions(projectId, {
      sectionId: sectionId || "custom",
      action: command.slice(0, 60),
      summary: explanation.slice(0, 120),
    }).catch(() => {});

    return {
      success: true,
      sectionId,
      revisedContent,
      explanation,
      usedCitations: parsed?.usedCitations || [],
      modelUsed: res.modelUsed,
    };
  } catch (err) {
    console.error("[chatWithProposal] Error:", err.message);
    throw new Error(`Gagal memproses revisi AI: ${err.message}`);
  }
}

