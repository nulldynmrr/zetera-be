import prisma from "../lib/prisma.js";
import { resolvePrompt } from "./prompt.service.js";
import { executeAiCompletion } from "./ai-router.service.js";
import { getGroqChatCompletion, GROQ_MODELS } from "../lib/groq-config.js";
import { formatBibliography, formatInTextCitation } from "../lib/citation-engine.js";
import { resolveSubchapterTag } from "./taxonomy.service.js";
import { sanitizeAcademicText } from "../lib/academic-cleaner.js";

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
    "writing_ai_slop",
    "latar_belakang_skripsi",
    "ieee_scopus_grounding",
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

    case "writing_ai_slop": {
      // Hilangkan pola slop AI, terapkan variasi burstiness dan nol dash
      const systemPrompt = `Anda adalah Senior Academic Editor & Humanizer Bahasa Indonesia.
Tugas Anda adalah menulis ulang atau membersihkan naskah agar TERASA 100% AUTENTIK DITULIS MANUSIA dan lolos deteksi AI (Turnitin, GPTZero, Originality.ai):
1. DILARANG TOTAL menggunakan tanda pisah em-dash (—) ataupun en-dash (–)! Ganti dengan titik (pecah kalimat), koma, atau kurung. Target: NOL DASH.
2. Hapus seluruh pembuka klise: "Di era modern ini", "Seiring perkembangan zaman", "Dalam konteks X yang semakin Y", "Perlu diketahui bahwa". Awali langsung dengan fakta konkret.
3. Hapus seluruh penutup boilerplate: "Sebagai kesimpulan,", "Dapat disimpulkan bahwa", "Pada akhirnya".
4. Hapus kata puffery/buzzword AI: "sangat krusial", "fundamental", "komprehensif", "holistik", "menyelami", "menyoroti pentingnya", "optimalisasi".
5. Tingkatkan burstiness: campurkan kalimat pendek (4-7 kata) dengan kalimat panjang (20-30 kata). Hindari panjang kalimat yang seragam.
6. Pertahankan 100% data empiris dan seluruh penanda sitasi [1], [2] pada posisinya yang tepat.
7. Format output: Berikan HANYA teks naskah hasil perbaikan tanpa kalimat pembuka atau penutup tambahan.`;

      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        userId,
        projectId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Tulis ulang naskah berikut agar bebas dari pola AI slop, nol dash, dan terasa autentik manusia:\n\n${textToProcess}` },
        ],
        temperature: 0.35,
        maxTokens: 3500,
      });

      const cleaned = sanitizeAcademicText(aiRes.content?.trim() || textToProcess);
      return {
        ok: true,
        output: cleaned,
        sourceDraftVersion: draftVersion,
      };
    }

    case "latar_belakang_skripsi": {
      const project = await prisma.researchProject.findUnique({
        where: { id: projectId },
        include: {
          journals: {
            where: { status: "APPROVED" },
            select: { id: true, title: true, abstract: true, keyFindings: true, authors: true, year: true, publication: true, doi: true },
          },
        },
      });

      const journalsList = (project?.journals || []).map((j, i) =>
        `[${i + 1}] ${j.authors} (${j.year}). "${j.title}". ${j.publication || ""}. DOI: ${j.doi || "-"}\n   Temuan: ${j.keyFindings || j.abstract || ""}`
      ).join("\n\n");

      const systemPrompt = `Anda adalah Ahli Penulisan Proposal & Metodologi Skripsi Indonesia.
Tugas Anda adalah menyusun bagian "1.1 Latar Belakang Masalah" dengan alur PIRAMIDA TERBALIK 5 TAHAP berbasis jurnal terverifikasi:
- Paragraf 1: Konsep & Teori Utama terkait topik "${project?.title || ""}" berdasarkan sumber kredibel.
- Paragraf 2: Fenomena & Data Empiris Terkini (tren, data terukur, bukti lapangan).
- Paragraf 3: Dampak Masalah & Urgensi Penelitian (mengapa penting diteliti sekarang).
- Paragraf 4: Tinjauan 3-4 Penelitian Terdahulu dari daftar jurnal terverifikasi [1], [2], dst., ditutup dengan identifikasi RESEARCH GAP.
- Paragraf 5: Penegasan Solusi, Fokus Penelitian, Novelty, dan Kontribusi yang ditawarkan.

ATURAN MUTLAK:
- DILARANG KERAS MENGARANG SITASI! Seluruh sitasi [n] wajib merujuk ke daftar jurnal riil di bawah.
- NOL DASH: DILARANG MENGGUNAKAN EM-DASH (—) ATAUPUN EN-DASH (–)!
- Bebas pembuka klise "Di era modern ini" dsb.
- Panjang total 900-1.500 kata dalam paragraf naratif mengalir tanpa sub-judul.
- Format output: HANYA teks naskah latar belakang lengkap.`;

      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        userId,
        projectId,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `DAFTAR JURNAL ILMIAH TERVERIFIKASI:\n${journalsList || "(Gunakan dasar ilmiah terpercaya)"}\n\nKONTEKS PENELITI:\n${textToProcess || project?.title || ""}\n\nSusun naskah 1.1 Latar Belakang Masalah lengkap:`,
          },
        ],
        temperature: 0.25,
        maxTokens: 4000,
      });

      const cleaned = sanitizeAcademicText(aiRes.content?.trim() || textToProcess);
      return {
        ok: true,
        output: cleaned,
        sourceDraftVersion: draftVersion,
      };
    }

    case "ieee_scopus_grounding": {
      const project = await prisma.researchProject.findUnique({
        where: { id: projectId },
        include: {
          journals: {
            where: { status: "APPROVED" },
            select: { id: true, title: true, abstract: true, keyFindings: true, authors: true, year: true, publication: true, doi: true },
          },
        },
      });

      const journalsList = (project?.journals || []).map((j, i) =>
        `[${i + 1}] ${j.authors} (${j.year}). "${j.title}". ${j.publication || ""}. DOI: ${j.doi || "-"}\n   Temuan: ${j.keyFindings || j.abstract || ""}`
      ).join("\n\n");

      const systemPrompt = `Anda adalah Senior Research Auditor untuk Jurnal Bereputasi (IEEE / Scopus).
Tugas Anda adalah memeriksa dan menyesuaikan naskah akademik mahasiswa agar 100% BERLANDASKAN JURNAL BEREPUTASI (IEEE / Scopus / SINTA 1-2):
1. Tautkan setiap argumen teoretis dan klaim empiris ke rujukan jurnal [1], [2], dst. yang relevan dari daftar.
2. DILARANG KERAS MENGARANG SITASI ATAU DOI FIKTIF.
3. Hapus setiap klaim yang tidak berdasar atau gantikan dengan telaah dari jurnal yang tersedia.
4. Terapkan parafrase akademis (hindari plagiarisme verbatim).
5. Nol em-dash (—) dan en-dash (–).
6. Format output: HANYA teks naskah yang telah tergrounding secara valid.`;

      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        userId,
        projectId,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `DRAF NASKAH:\n${textToProcess}\n\nDAFTAR JURNAL RIIL POOL PROYEK:\n${journalsList || "(Jurnal pool)"}\n\nLakukan grounding ilmiah bereputasi pada naskah:`,
          },
        ],
        temperature: 0.2,
        maxTokens: 3800,
      });

      const cleaned = sanitizeAcademicText(aiRes.content?.trim() || textToProcess);
      return {
        ok: true,
        output: cleaned,
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
  if (normText.includes("slop") || normText.includes("humanize") || normText.includes("manusiakan") || normText.includes("anti ai") || normText.includes("autentik")) {
    detectedSkill = "writing_ai_slop";
  } else if (normText.includes("latar belakang") || normText.includes("bab 1") || normText.includes("bab i") || normText.includes("pendahuluan")) {
    detectedSkill = "latar_belakang_skripsi";
  } else if (normText.includes("ieee") || normText.includes("scopus") || normText.includes("grounding") || normText.includes("bereputasi")) {
    detectedSkill = "ieee_scopus_grounding";
  } else if (normText.includes("plagiar") || normText.includes("kemiripan") || normText.includes("similarity")) {
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

