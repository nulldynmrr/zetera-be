import prisma from "../lib/prisma.js";
import Groq from "groq-sdk";
import { parseJsonFromText } from "../lib/groq-config.js";
import { executeAiCompletion } from "./ai-router.service.js";

// Helper for fallback Groq client
function getDirectGroqClient() {
  const apiKey =
    process.env.GROQ_API_KEY_SCREENING ||
    process.env.GROQ_API_KEY_FRAMEWORK_RELASI ||
    process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_demo") || apiKey === "gsk_your_groq_api_key_here") {
    return null;
  }
  return new Groq({ apiKey });
}

/**
 * 1. AI Brainstorming Topik Skripsi (TOPIC_BRAINSTORM)
 * Menghasilkan 3-5 kandidat judul skripsi bernas, mutakhir, dan relevan dengan minat mahasiswa.
 */
export async function brainstormTopics({ minat, kataKunci, masalahDitemukan, constraints, field, userId = null }) {
  const systemPrompt = `Anda adalah Dosen Pembimbing Utama & Pakar Metodologi Riset Skripsi di Universitas Terkemuka (Zetera AI).
Tugas Anda adalah merumuskan 4 (empat) kandidat judul skripsi yang bernas, orisinal, memiliki urgensi nyata (research gap), dan layak uji untuk mahasiswa.

Format output WAJIB JSON murni tanpa markdown wrapper/penjelasan di luar JSON:
{
  "candidates": [
    {
      "id": 1,
      "title": "Judul Skripsi Lengkap & Baku Sesuai EYD",
      "field": "Bidang Kajian",
      "recommendedApproach": "QUANTITATIVE", // QUANTITATIVE | QUALITATIVE | MIXED
      "coreProblem": "Rumusan masalah utama yang ingin dijawab dalam 1 kalimat.",
      "researchGap": "Urgensi fenomena dan celah riset yang membedakan dengan penelitian sebelumnya.",
      "potentialVariables": ["Variabel X / Fokus", "Variabel Y / Dampak"],
      "feasibility": "Tinggi (Dapat diselesaikan dalam 1-2 semester)"
    }
  ]
}`;

  const userPrompt = `Permintaan Brainstorming Topik Skripsi:
- Bidang Minat / Ketertarikan: ${minat || "Teknologi Informasi / Kesehatan / Manajemen"}
- Kata Kunci / Objek Riset: ${kataKunci || "Penerapan AI dan Dampak Sosial"}
${masalahDitemukan ? `- Fenomena / Masalah Nyata yang Sudah Ditemukan: "${masalahDitemukan}"` : ""}
- Program Studi / Bidang Ilmu: ${field || "Umum"}
- Batasan / Kendala Khusus: ${constraints || "Harus realistis diselesaikan dalam 1-2 semester"}

${masalahDitemukan ? `PERHATIAN UTAMA: Mahasiswa telah menemukan masalah nyata: "${masalahDitemukan}". Rancang kandidat judul, coreProblem, dan researchGap yang berfokus secara langsung untuk menganalisis, menguji, atau memberikan solusi terhadap masalah empiris tersebut!` : ""}

Rancang 4 rekomendasi judul dengan variasi sudut pandang metodologis (kuantitatif, kualitatif, dan terapan).`;

  try {
    // Coba via AI Router Engine
    const aiResponse = await executeAiCompletion({
      featureCode: "TOPIC_BRAINSTORM",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 3000,
      jsonMode: true,
      userId,
    }).catch(() => null);

    if (aiResponse?.content) {
      const parsed = parseJsonFromText(aiResponse.content);
      if (parsed?.candidates && parsed.candidates.length > 0) {
        return parsed.candidates;
      }
    }
  } catch (_) {}

  // Direct Fallback ke Groq
  const groq = getDirectGroqClient();
  if (groq) {
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    const parsed = parseJsonFromText(chat.choices[0]?.message?.content || "");
    if (parsed?.candidates) return parsed.candidates;
  }

  // Smart Deterministic Fallback
  return [
    {
      id: 1,
      title: `Analisis Pengaruh ${kataKunci || minat || "Teknologi Informasi"} Terhadap Efektivitas Kinerja Pengguna`,
      field: field || "Umum",
      recommendedApproach: "QUANTITATIVE",
      coreProblem: `Bagaimana tingkat pengaruh dan signifikansi ${kataKunci || minat} terhadap performa operasional?`,
      researchGap: "Belum banyak kajian empiris yang mengukur efektivitas secara kuantitatif pada populasi terkini.",
      potentialVariables: [kataKunci || "Teknologi", "Efektivitas Kinerja"],
      feasibility: "Tinggi",
    },
    {
      id: 2,
      title: `Eksplorasi Persepsi dan Pengalaman Pengguna dalam Implementasi ${kataKunci || minat || "Sistem Baru"}`,
      field: field || "Umum",
      recommendedApproach: "QUALITATIVE",
      coreProblem: `Bagaimana pengalaman subjektif dan faktor penghambat adopsi ${kataKunci || minat}?`,
      researchGap: "Diperlukan pemahaman kualitatif mendalam mengenai resistensi dan adaptasi pengguna.",
      potentialVariables: ["Pengalaman Pengguna", "Faktor Hambatan"],
      feasibility: "Tinggi",
    },
  ];
}

/**
 * 2. AI Dynamic Outline & Sub-Bab Builder (PROPOSAL_OUTLINE_RECOMMEND)
 * Menghasilkan struktur sub-bab Bab 1, 2, dan 3 yang spesifik, kaya teori, dan memikat.
 */
export async function recommendOutline({ title, field, approachType = "QUANTITATIVE", approachConfig = null, userId = null }) {
  const systemPrompt = `Anda adalah Pakar Metodologi Penulisan Proposal Tugas Akhir & Skripsi (Zetera AI).
Tugas Anda adalah merancang struktur sub-bab (outline) proposal skripsi Bab 1, 2, dan 3 yang spesifik, ilmiah, dan terstruktur rapi sesuai standar akademik:

STANDAR STRUKTUR WAJIB:
- BAB I: 1.1 Latar Belakang, 1.2 Perumusan Masalah, 1.3 Batasan Masalah, 1.4 Tujuan Penelitian, 1.5 Manfaat Penelitian
- BAB II: 2.1 Tinjauan Pustaka, 2.2 Landasan Teori (rancang sub-bab konsep teknis yang relevan dengan topik, misal: 2.2.1, 2.2.2, 2.2.3, ... disesuaikan dengan metode/domain riset)
- BAB III: 3.1 Subjek dan Objek Penelitian, 3.2 Alat dan Bahan Penelitian (3.2.1 Hardware, 3.2.2 Software, 3.2.3 Dataset), 3.3 Diagram Alur Penelitian (3.3.1 Pengumpulan Data, 3.3.2 Preprocessing, 3.3.3 Pemodelan/Pelatihan, 3.3.4 Skenario Pengujian)

SITASI: Format IEEE menggunakan nomor sitasi dalam kurung siku [1], [2].

Format output WAJIB JSON murni tanpa markdown wrapper:
{
  "bab1": [
    { "id": "1.1", "title": "Latar Belakang", "guidance": "Urgensi fenomena digital, data statistik pendukung, dan justifikasi pemilihan metode dengan sitasi [1]." },
    { "id": "1.2", "title": "Perumusan Masalah", "guidance": "Pertanyaan penelitian utama yang spesifik dan terukur." },
    { "id": "1.3", "title": "Batasan Masalah", "guidance": "Fokus ruang lingkup dataset, algoritma, dan metrik evaluasi." },
    { "id": "1.4", "title": "Tujuan Penelitian", "guidance": "Target capaian dan efektivitas model/sistem yang dibangun." },
    { "id": "1.5", "title": "Manfaat Penelitian", "guidance": "Manfaat teoretis bagi akademisi dan praktis bagi industri/masyarakat." }
  ],
  "bab2": [
    { "id": "2.1", "title": "Tinjauan Pustaka", "guidance": "Kajian komparasi penelitian terdahulu dan pemetaan research gap." },
    { "id": "2.2", "title": "Landasan Teori", "guidance": "Konsep teknis, metode, dan algoritma pendukung penelitian." }
  ],
  "bab3": [
    { "id": "3.1", "title": "Subjek dan Objek Penelitian", "guidance": "Penjelasan entitas subjek dan karakteristik data yang dianalisis." },
    { "id": "3.2", "title": "Alat dan Bahan Penelitian", "guidance": "Spesifikasi perangkat keras, perangkat lunak/library, dan sumber dataset." },
    { "id": "3.3", "title": "Diagram Alur Penelitian", "guidance": "Tahapan metodologi dari pengumpulan data, preprocessing, pemodelan, hingga evaluasi." }
  ]
}`;

  const userPrompt = `Rancang Struktur Sub-Bab Proposal Skripsi Spesifik Topik:
- Judul Skripsi: "${title || "Penelitian Skripsi"}"
- Bidang Kajian: "${field || "Teknik Informatika"}"
- Pendekatan Riset: "${approachType}"
- Konfigurasi Variabel/Fokus: ${JSON.stringify(approachConfig || {})}`;

  try {
    const aiResponse = await executeAiCompletion({
      featureCode: "PROPOSAL_OUTLINE_RECOMMEND",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 3000,
      jsonMode: true,
      userId,
    }).catch(() => null);

    if (aiResponse?.content) {
      const parsed = parseJsonFromText(aiResponse.content);
      if (parsed?.bab1 && parsed?.bab2 && parsed?.bab3) {
        return parsed;
      }
    }
  } catch (_) {}

  // Fallback ke Groq
  const groq = getDirectGroqClient();
  if (groq) {
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    const parsed = parseJsonFromText(chat.choices[0]?.message?.content || "");
    if (parsed?.bab1) return parsed;
  }

  // Default Standard Academic Template
  return {
    bab1: [
      { id: "1.1", title: "Latar Belakang", guidance: "Urgensi fenomena empiris, masalah nyata, dan justifikasi pemilihan metode [1]." },
      { id: "1.2", title: "Perumusan Masalah", guidance: "Pertanyaan penelitian utama." },
      { id: "1.3", title: "Batasan Masalah", guidance: "Fokus dataset, arsitektur algoritma, dan metrik." },
      { id: "1.4", title: "Tujuan Penelitian", guidance: "Target spesifik yang ingin dicapai." },
      { id: "1.5", title: "Manfaat Penelitian", guidance: "Manfaat teoretis dan kontribusi praktis." },
    ],
    bab2: [
      { id: "2.1", title: "Tinjauan Pustaka", guidance: "Rangkuman studi terdahulu dan matriks perbandingan riset." },
      { id: "2.2", title: "Landasan Teori", guidance: "Konsep dasar, preprocessing, embedding, arsitektur model, dan evaluasi." },
    ],
    bab3: [
      { id: "3.1", title: "Subjek dan Objek Penelitian", guidance: "Spesifikasi subjek dan sumber data penelitian." },
      { id: "3.2", title: "Alat dan Bahan Penelitian", guidance: "Hardware, Software, dan Dataset." },
      { id: "3.3", title: "Diagram Alur Penelitian", guidance: "Pengumpulan Data, Preprocessing, Pemodelan, dan Skenario Eksperimen." },
    ],
  };
}

/**
 * 3. Bi-Directional: Sync Proposal Draft to Framework Canvas
 * Mengekstrak variabel dan relasi dari naskah proposal yang sudah jadi ke node React Flow.
 */
export async function syncProposalToFramework({ projectId, userId, proposalText = "" }) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new Error("Project tidak ditemukan");
  }

  const prompt = `Anda adalah Arsitek Kerangka Berpikir Riset (Framework Canvas Builder).
Tugas Anda adalah membaca naskah proposal skripsi berikut dan mengekstrak entitas variabel/konsep penting beserta hubungan kausalitasnya.

Judul Proyek: "${project.title}"
Isi Naskah Proposal:
${proposalText.slice(0, 5000)}

Format Output WAJIB JSON murni:
{
  "nodes": [
    {
      "label": "Nama Variabel / Konsep",
      "type": "VARIABLE", // VARIABLE | CONCEPT | METHOD | THEORY
      "description": "Deskripsi operasional singkat",
      "positionX": 150,
      "positionY": 150
    }
  ],
  "edges": [
    {
      "sourceLabel": "Variabel Asal",
      "targetLabel": "Variabel Tujuan",
      "relationshipLabel": "Mempengaruhi Positif (+)"
    }
  ]
}`;

  let extractedData = null;
  const groq = getDirectGroqClient();
  if (groq) {
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    extractedData = parseJsonFromText(chat.choices[0]?.message?.content || "");
  }

  if (!extractedData?.nodes || extractedData.nodes.length === 0) {
    // Fallback node generation
    extractedData = {
      nodes: [
        { label: "Variabel Independen (X)", type: "VARIABLE", description: "Faktor pengaruh utama", positionX: 120, positionY: 180 },
        { label: "Variabel Dependen (Y)", type: "VARIABLE", description: "Hasil / dampak terukur", positionX: 420, positionY: 180 },
      ],
      edges: [
        { sourceLabel: "Variabel Independen (X)", targetLabel: "Variabel Dependen (Y)", relationshipLabel: "Mempengaruhi Positif (+)" }
      ]
    };
  }

  // Simpan ke database: framework_nodes & framework_edges
  const createdNodes = [];
  for (let i = 0; i < extractedData.nodes.length; i++) {
    const n = extractedData.nodes[i];
    const node = await prisma.frameworkNode.create({
      data: {
        projectId,
        label: n.label,
        type: n.type || "VARIABLE",
        description: n.description || "",
        positionX: n.positionX || (120 + (i * 220)),
        positionY: n.positionY || 180,
      },
    });
    createdNodes.push(node);
  }

  // Buat edges
  const createdEdges = [];
  if (extractedData.edges && extractedData.edges.length > 0) {
    for (const e of extractedData.edges) {
      const sourceNode = createdNodes.find((cn) => cn.label.toLowerCase().includes(e.sourceLabel?.toLowerCase() || ""));
      const targetNode = createdNodes.find((cn) => cn.label.toLowerCase().includes(e.targetLabel?.toLowerCase() || ""));
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        const edge = await prisma.frameworkEdge.create({
          data: {
            projectId,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            relationshipLabel: e.relationshipLabel || "Mempengaruhi Positif (+)",
          },
        });
        createdEdges.push(edge);
      }
    }
  }

  return {
    nodesCreated: createdNodes.length,
    edgesCreated: createdEdges.length,
    nodes: createdNodes,
    edges: createdEdges,
  };
}

/**
 * 4. AI Refine Proposal Narrative & Scope (Perbaiki Input Ngasal dengan Groq)
 * Memperbaiki, menyempurnakan, dan melengkapi Latar Belakang, Tujuan, dan Batasan Masalah.
 */
export async function refineProposalNarrative({
  title,
  field = "Umum",
  approachType = "QUANTITATIVE",
  approachConfig = {},
  commonNarrative = {},
  currentBackground = "",
  currentPurpose = "",
  currentScope = "",
  userId = null,
}) {
  const currentBg = (commonNarrative?.background || currentBackground || "").trim();
  const currentPurp = (commonNarrative?.purpose || currentPurpose || "").trim();
  const currentScp = (commonNarrative?.scope || currentScope || "").trim();

  // Ringkas konfigurasi pendekatan untuk konteks AI
  let approachDetails = `Pendekatan: ${approachType}`;
  if (approachConfig?.quantitative) {
    const q = approachConfig.quantitative;
    approachDetails += `\n- Variabel Bebas (X): ${q.variableX || "-"}\n- Variabel Terikat (Y): ${q.variableY || "-"}\n- Hipotesis: ${q.hypothesis || "-"}\n- Populasi/Sampel: ${q.population || "-"}`;
  }
  if (approachConfig?.qualitative) {
    const ql = approachConfig.qualitative;
    approachDetails += `\n- Fokus Masalah: ${ql.focus || "-"}\n- Informan Kunci: ${ql.informants || "-"}\n- Teknik Pengumpulan: ${ql.dataMethod || "-"}`;
  }

  const systemPrompt = `Anda adalah Pakar Metodologi Penelitian & Dosen Pembimbing Skripsi Akademik Terkemuka (Zetera AI).
TUGAS ANDA: Melakukan BRAINSTORMING MENDALAM & MENYEMPURNAKAN draf awal narasi proposal skripsi mahasiswa (Latar Belakang Singkat, Tujuan Penelitian, dan Batasan Masalah) agar kontekstual, tajam, dan memenuhi standar mutu akademik universitas.

PANDUAN UTAMA BRAINSTORMING AKADEMIS:
1. SANGAT PENTING: DILARANG KERAS MENYERTAKAN SITASI PUSTAKA, NOMOR KURUNG SIKU [1], [2], ATAU KLAIM NAMA PENULIS TERTENTU. Narasi umum tahap ini adalah murni perumusan logika ide penelitian, BUKAN kutipan literatur.
2. JANGAN GUNAKAN TEMPLATE GENERIK/ROBOTIK (HINDARI kalimat klise seperti: "Penelitian mengenai X memiliki urgensi penting untuk menjawab permasalahan pada bidang Y..."). Anda WAJIB menganalisis secara mendalam kata kunci pada judul skripsi, objek spesifik, metode, dan dinamika riil di bidang ${field}.
3. ADAPTASI & PARAFRASA INPUT MAHASISWA:
   - Jika mahasiswa sudah menuliskan ide/draft (Latar Belakang, Tujuan, atau Batasan): Gunakan ide inti mahasiswa tersebut dan poles (parafrasa akademis) menjadi kalimat ilmiah yang baku, elegan, dan terstruktur.
   - Jika draf mahasiswa masih kosong atau sangat minim/singkat: Lakukan brainstorming konstruktif yang konkret, relevan, dan realistis sesuai topik "${title}".
4. LATAR BELAKANG SINGKAT (background):
   - Tulis 2 sampai 3 kalimat bernas dan padat masalah:
     * Kalimat 1: Fenomena nyata di lapangan atau urgensi operasional terkait topik.
     * Kalimat 2: Problem spesifik, kendala pengguna/sistem, atau kesenjangan yang terjadi.
     * Kalimat 3: Solusi atau fokus penelitian yang diajukan untuk memecahkan problem tersebut.
5. TUJUAN PENELITIAN (purpose):
   - Rumuskan 2 sampai 3 butir tujuan penelitian deklaratif yang terukur dan operasional.
   - Gunakan format penomoran:
     1. Menganalisis / Mengidentifikasi...
     2. Merancang / Mengembangkan...
     3. Menguji / Mengevaluasi...
6. BATASAN MASALAH (scope):
   - Rumuskan 1-2 batasan konkret (misal batasan objek/populasi subjek riset, batasan fitur/variabel, batasan instrumen atau tools).

Format output WAJIB JSON murni tanpa markdown:
{
  "background": "Latar belakang 2-3 kalimat tajam tanpa sitasi...",
  "purpose": "1. Menganalisis...\\n2. Merancang...\\n3. Menguji...",
  "scope": "Penelitian dibatasi pada..."
}`;

  const userPrompt = `Data Proposal Mahasiswa:
- Judul Skripsi: "${title}"
- Program Studi / Bidang: "${field}"
- Metodologi Riset:
${approachDetails}

Draf Mentah Awal dari Mahasiswa:
- Latar Belakang: ${currentBg ? `"${currentBg}"` : "(Belum diisi, mohon buatkan brainstorming tajam dan spesifik)"}
- Tujuan: ${currentPurp ? `"${currentPurp}"` : "(Belum diisi, mohon buatkan 2-3 tujuan operasional)"}
- Batasan Masalah: ${currentScp ? `"${currentScp}"` : "(Belum diisi, mohon buatkan batasan ruang lingkup yang realistis)"}

Instruksi: Sempurnakan ketiga butir di atas menjadi narasi ilmiah berkualitas tinggi yang siap diajukan ke Dosen Pembimbing, TANPA SITASI!`;

  let refined = null;

  // Coba via Groq Direct Client jika ada
  const groq = getDirectGroqClient();
  if (groq) {
    try {
      const chat = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });
      refined = parseJsonFromText(chat.choices[0]?.message?.content || "");
    } catch (_) {}
  }

  // Fallback via AI Router Router
  if (!refined?.background) {
    try {
      const aiRes = await executeAiCompletion({
        featureCode: "PROPOSAL_SECTION_SYNTHESIS",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        maxTokens: 1500,
        jsonMode: true,
        userId,
      });
      if (aiRes?.content) {
        refined = parseJsonFromText(aiRes.content);
      }
    } catch (_) {}
  }

  // Fallback kontekstual berbasis judul jika AI offline
  if (!refined?.background) {
    const cleanWords = title.replace(/[^\w\s]/gi, "").trim();
    refined = {
      background: currentBg || `Kajian mengenai "${cleanWords}" menjadi fokus penting dalam bidang ${field} guna mengatasi kendala operasional dan optimalisasi implementasi di lapangan. Penelitian ini menitikberatkan pada pengujian terarah dan perumusan solusi konkret berbasis data empiris.`,
      purpose: currentPurp || `1. Mengidentifikasi kebutuhan dan permasalahan utama yang berkaitan dengan ${cleanWords}.\n2. Menganalisis implementasi serta kinerja variabel utama pada objek penelitian.\n3. Memberikan rekomendasi strategis dan solusi terapan yang aplikatif bagi pengembangan bidang ${field}.`,
      scope: currentScp || `Penelitian dibatasi pada ruang lingkup objek studi ${cleanWords}, pengamatan variabel utama, serta instrumen pengukuran yang relevan pada bidang ${field}.`,
    };
  }

  return {
    background: refined.background?.trim() || currentBg,
    purpose: refined.purpose?.trim() || currentPurp,
    scope: refined.scope?.trim() || currentScp,
  };
}
