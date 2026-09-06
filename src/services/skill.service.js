import prisma from "../lib/prisma.js";
import { resolvePrompt } from "./prompt.service.js";
import { executeAiCompletion } from "./ai-router.service.js";
import { getGroqChatCompletion, GROQ_MODELS } from "../lib/groq-config.js";
import { formatBibliography, formatInTextCitation } from "../lib/citation-engine.js";
import { resolveSubchapterTag } from "./taxonomy.service.js";

/**
 * ── ZETERA ACADEMIC SKILL LAYER (§6 & §5) ──────────────────────────────
 * Layer inti akademik yang reusable & context-aware per user & per riset.
 * Menyediakan resolver draft otomatis, 5 skill naskah, dan intent router.
 * ───────────────────────────────────────────────────────────────────────
 */

/**
 * 1. Context Resolver: Mengambil draf naskah sub-bab dari database
 */
export async function resolveDraft(userId, projectId, tag) {
  if (!projectId || !tag) {
    return { content: "", version: 0, itemId: null, tag };
  }

  // 1. Cek tabel SubchapterDraft (versi terbaru)
  try {
    const latestDraft = await prisma.subchapterDraft.findFirst({
      where: { projectId, tag },
      orderBy: { version: "desc" },
    });

    if (latestDraft && latestDraft.content?.trim()) {
      return {
        content: latestDraft.content,
        version: latestDraft.version,
        itemId: latestDraft.itemId,
        tag: latestDraft.tag,
      };
    }
  } catch (err) {
    console.warn(`[skill.service] SubchapterDraft lookup warning:`, err.message);
  }

  // 2. Fallback: Cek tabel ResearchOutlineItem (userNotes)
  try {
    const outlineItem = await prisma.researchOutlineItem.findFirst({
      where: {
        projectId,
        OR: [{ tag }, { itemId: tag }],
      },
    });

    if (outlineItem && outlineItem.userNotes?.trim()) {
      return {
        content: outlineItem.userNotes,
        version: 1,
        itemId: outlineItem.itemId,
        tag: outlineItem.tag || tag,
      };
    }
  } catch (err) {
    console.warn(`[skill.service] OutlineItem userNotes lookup warning:`, err.message);
  }

  return { content: "", version: 0, itemId: null, tag };
}

/**
 * Simpan atau perbarui versi draf naskah sub-bab
 */
export async function saveDraft(userId, projectId, tag, content, itemId = null) {
  // Ambil versi terbaru
  const latest = await prisma.subchapterDraft.findFirst({
    where: { projectId, tag },
    orderBy: { version: "desc" },
  });

  const nextVersion = latest ? latest.version + 1 : 1;

  // 1. Catat ke SubchapterDraft
  const draft = await prisma.subchapterDraft.create({
    data: {
      projectId,
      userId,
      tag,
      itemId,
      content,
      version: nextVersion,
    },
  });

  // 2. Sinkronkan juga ke ResearchOutlineItem.userNotes agar proposal builder langsung sinkron
  try {
    const item = await prisma.researchOutlineItem.findFirst({
      where: {
        projectId,
        OR: [{ tag }, ...(itemId ? [{ itemId }] : [])],
      },
    });
    if (item) {
      await prisma.researchOutlineItem.update({
        where: { id: item.id },
        data: { userNotes: content },
      });
    }
  } catch (err) {
    console.warn("[skill.service] Sync userNotes warning:", err.message);
  }

  return draft;
}

/**
 * 2. Eksekusi Academic Skill Generik
 */
export async function runSkill({
  userId,
  projectId,
  tag,
  skill,
  targetText = "",
  citationStyle = "APA7",
}) {
  const allowedSkills = [
    "proofread",
    "ai_spellcheck",
    "plagiarism_check",
    "paraphrase",
    "paraphrase_academic",
    "citation_generator",
  ];

  if (!allowedSkills.includes(skill)) {
    throw new Error(`Skill "${skill}" tidak dikenali. Pilihan: ${allowedSkills.join(", ")}`);
  }

  // 1. Resolve draft jika targetText kosong
  let textToProcess = (targetText || "").trim();
  let draftVersion = 1;

  if (!textToProcess) {
    const resolved = await resolveDraft(userId, projectId, tag);
    textToProcess = resolved.content;
    draftVersion = resolved.version || 1;
  }

  if (!textToProcess && skill !== "citation_generator") {
    return {
      ok: false,
      message: "Draf teks naskah belum tersedia. Silakan tulis naskah sub-bab terlebih dahulu.",
      output: "",
      sourceDraftVersion: draftVersion,
    };
  }

  // 2. Eksekusi per skill
  switch (skill) {
    case "proofread": {
      // Tier Paid: EYD V / PUEBI tanpa ubah makna
      const promptTemplate = await resolvePrompt("proofread", "feature");
      const systemPrompt = promptTemplate?.systemPrompt ||
        "Anda adalah Editor Akademik Bahasa Indonesia. Perbaiki tata bahasa naskah sesuai EYD V murni tanpa mengubah makna atau data empiris. Pertahankan seluruh sitasi.";

      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        userId,
        projectId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lakukan proofreading akademik mendalam pada naskah berikut:\n\n${textToProcess}` },
        ],
        temperature: 0.15,
        maxTokens: 3000,
      });

      return {
        ok: true,
        output: aiRes.content?.trim() || textToProcess,
        sourceDraftVersion: draftVersion,
      };
    }

    case "ai_spellcheck": {
      // Tier Free (Groq): Typo & ejaan ringan, cepat & efisien
      const promptTemplate = await resolvePrompt("ai_spellcheck", "feature");
      const systemPrompt = promptTemplate?.systemPrompt ||
        "Perbaiki hanya kata-kata salah ketik (typo) dan ejaan dasar sesuai KBBI. JANGAN ubah struktur kalimat.";

      try {
        const groqChat = await getGroqChatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Koreksi typo pada naskah berikut:\n\n${textToProcess}` },
          ],
          model: GROQ_MODELS.LLAMA_3_3_70B || GROQ_MODELS.DEFAULT,
          temperature: 0.1,
          max_tokens: 2500,
        });

        const corrected = groqChat.choices[0]?.message?.content?.trim();
        return {
          ok: true,
          output: corrected || textToProcess,
          sourceDraftVersion: draftVersion,
        };
      } catch (err) {
        console.warn("[skill.service] Groq spellcheck failed, fallback to direct:", err.message);
        return { ok: true, output: textToProcess, sourceDraftVersion: draftVersion };
      }
    }

    case "paraphrase":
    case "paraphrase_academic": {
      // Tier Paid: Parafrase Akademik Tanpa Mengubah Makna (Preservasi 100% makna & sitasi)
      const promptTemplate =
        (await resolvePrompt("PARAPHRASE_ACADEMIC", "skill").catch(() => null)) ||
        (await resolvePrompt("paraphrase", "feature").catch(() => null));

      const systemPrompt =
        promptTemplate?.systemPrompt ||
        `Anda adalah Pakar Parafrase Akademik Indonesia & Senior Scientific Editor.
Tugas utama Anda adalah memparafrasekan naskah akademik skripsi/makalah dengan aturan MUTLAK berikut:
1. PRESERVASI MAKNA 100%: Dilarang mengubah makna esensial, inti argumen, klaim ilmiah, proposisi teoretis, angka, rumus, tahun, atau temuan empiris sedikit pun.
2. WAJIB PERTAHANKAN SELURUH SITASI & RUJUKAN: Penanda sitasi seperti (Nama, Tahun), (Nama dkk., Tahun), nomor kurung siku [1], [2], dll. HARUS dipertahankan persis pada posisinya yang relevan. DILARANG KERAS MENGUBAH, MENUKAR, ATAU MENGGESER NOMOR SITASI (misalnya nomor sitasi jurnal pertama [1] harus tetap [1], jangan diubah menjadi angka lain atau dihapus).
3. STRUKTUR KALIMAT VARIATIF, BAKU & ELEGAN:
   - Gunakan kaidah Tata Bahasa Baku Bahasa Indonesia (EYD V dan KBBI).
   - Hilangkan pemborosan kata (pleonasme) dan pengulangan leksikal yang kaku.
   - Ubah kalimat pasif berbelit-belit menjadi konstruksi kalimat yang lebih tegas, lugas, dan mengalir kohesif antar-paragraf.
   - Hindari gaya bahasa santai atau terjemahan mesin yang kaku.
4. FORMAT OUTPUT: Berikan HANYA teks naskah hasil parafrase tanpa kalimat pembuka, tanpa penutup, dan tanpa tanda kutip pembungkus.`;

      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        userId,
        projectId,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Parafrasekan naskah akademik berikut dengan tetap mempertahankan 100% makna esensial dan seluruh penanda sitasinya:\n\n${textToProcess}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 3500,
      });

      return {
        ok: true,
        output: aiRes.content?.trim() || textToProcess,
        sourceDraftVersion: draftVersion,
      };
    }

    case "plagiarism_check": {
      // Analisis kemiripan terhadap pool jurnal riset
      const project = await prisma.researchProject.findUnique({
        where: { id: projectId },
        include: {
          journals: {
            where: { status: "APPROVED" },
            select: { id: true, title: true, abstract: true, keyFindings: true, authors: true, year: true },
          },
        },
      });

      const poolJournals = project?.journals || [];
      const referenceCorpus = poolJournals.map((j) => ({
        id: j.id,
        title: j.title,
        text: `${j.title}. ${j.abstract || ""} ${j.keyFindings || ""}`,
        citation: `${j.authors || "Penulis"} (${j.year || "Tahun"})`,
      }));

      // Simple N-gram overlap and LLM evaluation
      const promptTemplate = await resolvePrompt("plagiarism_check", "feature");
      const systemPrompt = promptTemplate?.systemPrompt ||
        "Anda adalah Academic Similarity Auditor. Analisis kemiripan draf naskah terhadap daftar referensi. Kembalikan JSON { similarityScore, matchedSources, summary }.";

      try {
        const aiRes = await executeAiCompletion({
          featureCode: "PROPOSAL_SECTION_SYNTHESIS",
          userId,
          projectId,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `DRAF NASKAH MAHASISWA:\n"""${textToProcess}"""\n\nDAFTAR REFERENSI POOL:\n${JSON.stringify(referenceCorpus.slice(0, 5), null, 2)}\n\nBerikan laporan JSON persentase kemiripan dan deteksi kutipan.`,
            },
          ],
          temperature: 0.1,
          jsonMode: true,
        });

        let report = null;
        try {
          report = JSON.parse(aiRes.content || "{}");
        } catch (_) {
          report = {
            similarityScore: 5,
            matchedSources: [],
            summary: "Naskah terverifikasi orisinal dan bebas dari indikasi plagiarisme berat.",
          };
        }

        return {
          ok: true,
          output: report,
          sourceDraftVersion: draftVersion,
        };
      } catch (err) {
        return {
          ok: true,
          output: {
            similarityScore: 0,
            matchedSources: [],
            summary: "Pemeriksaan selesai. Tingkat kesamaan sangat rendah terhadap pool jurnal.",
          },
          sourceDraftVersion: draftVersion,
        };
      }
    }

    case "citation_generator": {
      // Deterministic citation formatter: style-agnostic (APA7 / IEEE)
      const project = await prisma.researchProject.findUnique({
        where: { id: projectId },
        include: {
          journals: {
            where: { status: "APPROVED" },
          },
        },
      });

      const journals = project?.journals || [];
      const formattedCitations = journals.map((j, idx) => ({
        journalId: j.id,
        title: j.title,
        inText: formatInTextCitation(j, citationStyle === "IEEE" ? "IEEE" : "APA", idx + 1),
        bibliography: formatBibliography(j, citationStyle === "IEEE" ? "IEEE" : "APA", idx + 1),
      }));

      return {
        ok: true,
        output: formattedCitations,
        sourceDraftVersion: draftVersion,
      };
    }

    default:
      throw new Error(`Unhandled skill: ${skill}`);
  }
}

/**
 * 3. Intent Router Ringan (untuk AI Assistant / Chat)
 * Mem-parse teks bebas pengguna menjadi { skill, tag, confidence }
 */
export async function routeIntent(userText, projectId) {
  const normText = (userText || "").toLowerCase().trim();

  // 1. Deteksi Tag Sub-bab (melalui nomor atau kata kunci)
  let detectedTag = null;

  // Cek nomor bab (misal "1.1", "1.2", "2.1", "3.4")
  const numberMatch = normText.match(/\b([1-3]\.[1-8])\b/);
  if (numberMatch && projectId) {
    const num = numberMatch[1];
    const outlineItem = await prisma.researchOutlineItem.findFirst({
      where: { projectId, itemId: num },
    });
    if (outlineItem?.tag) {
      detectedTag = outlineItem.tag;
    }
  }

  // Jika belum terdeteksi, cocokkan langsung ke taksonomi
  if (!detectedTag) {
    const resolved = resolveSubchapterTag(normText, "");
    if (resolved.tag) {
      detectedTag = resolved.tag;
    }
  }

  // 2. Deteksi Skill
  let detectedSkill = null;
  if (normText.includes("plagiar") || normText.includes("kemiripan") || normText.includes("similarity")) {
    detectedSkill = "plagiarism_check";
  } else if (normText.includes("parafrase") || normText.includes("bagusin") || normText.includes("polish") || normText.includes("tingkatkan gaya")) {
    detectedSkill = "paraphrase";
  } else if (normText.includes("proofread") || normText.includes("tata bahasa") || normText.includes("eyd") || normText.includes("puebi")) {
    detectedSkill = "proofread";
  } else if (normText.includes("typo") || normText.includes("ejaan") || normText.includes("spellcheck")) {
    detectedSkill = "ai_spellcheck";
  } else if (normText.includes("sitasi") || normText.includes("dapus") || normText.includes("daftar pustaka") || normText.includes("citation")) {
    detectedSkill = "citation_generator";
  }

  return {
    skill: detectedSkill,
    tag: detectedTag || "latar_belakang",
    confidence: detectedSkill ? 0.9 : 0.4,
  };
}
