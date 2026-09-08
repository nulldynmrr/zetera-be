/**
 * Script Migrasi Sub-bab ke Rules, Varian & Output Spec
 * Dokumen Acuan: /docs/EXECUTE/020-rencana-perbaikan-zetera.md (§4.1)
 *
 * Membaca 24 spesifikasi sub-bab dari ALL_SUBCHAPTER_SPECS,
 * memecah aturan penulisan menjadi entitas Rule reusable,
 * menyematkan varian pendekatan penelitian (Kuantitatif/Kualitatif/Eksperimen/dll),
 * dan memasang relasi SubBabRuleMapping serta OutputSpec.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ALL_SUBCHAPTER_SPECS } from "../subchapters/index.js";

const prisma = new PrismaClient();

// ── 1. DEFINISI RULES UMUM / REUSABLE (Writing Style, Structural, Citation) ──
const CORE_GLOBAL_RULES = [
  {
    slug: "wiriting-ai-slop",
    name: "Anti AI-Slop & Gaya Akademis Baku",
    category: "WRITING_STYLE",
    description: "Mencegah basa-basi klise robotik AI, memaksa formulasi kalimat akademis baku berbasis EYD V, tegas, bernas, dan kohesif.",
    systemPrompt: `ATURAN GAYA PENULISAN (ANTI AI-SLOP & FORMALITAS AKADEMIK):
1. DILARANG KERAS menggunakan frasa klise generik AI seperti "Di era digital saat ini", "Dalam dunia yang serba cepat", "Penting untuk dicatat bahwa", "Secara keseluruhan", atau "Menyelami lebih dalam".
2. Gunakan kalimat deklaratif akademis baku (EYD V / PUEBI). Kalimat harus padat makna, berbobot, langsung pada pokok substansi, dan tidak bertele-tele.
3. Gunakan sudut pandang orang ketiga ("penulis", "peneliti", atau kalimat pasif formal). Hindari kata ganti informal ("saya", "kita", "kamu").
4. Jalin kohesi dan koherensi antar paragraf dengan konjungsi akademis bertingkat yang proporsional (misalnya "Kendati demikian", "Oleh karena itu", "Di samping itu", "Secara spesifik").`,
  },
  {
    slug: "eyd-v",
    name: "Kaidah EYD V & PUEBI Baku",
    category: "WRITING_STYLE",
    description: "Menstandarkan ejaan istilah teknis, serapan asing miring (italic), tanda baca titik-koma, dan struktur kalimat formal bahasa Indonesia.",
    systemPrompt: `ATURAN EJAAN & TATA BAHASA EYD EDISI V:
1. Istilah asing yang belum diserap resmi ke KBBI wajib dicetak miring (italic) atau ditulis serapan baku (misal: "machine learning" -> italic, atau "pembelajaran mesin").
2. Pastikan subjek dan predikat kalimat lengkap dan tegas; hindari kalimat menggantung yang diawali konjungsi antarkalimat di awal anak kalimat tanpa induk kalimat.
3. Penulisan tanda baca koma setelah keterangan awal kalimat wajib dipatuhi.`,
  },
  {
    slug: "intro-sentence",
    name: "Kalimat Pengantar Akademis Baku",
    category: "STRUCTURAL",
    description: "Wajib menyertakan 1-2 kalimat pengantar akademis pembuka sebelum daftar butir penomoran agar tidak langsung angka 1.",
    systemPrompt: `ATURAN PENGANTAR STRUKTURAL:
1. AWALI DENGAN 1–2 KALIMAT PENGANTAR AKADEMIS BAKU SEBELUM MASUK KE BUTIR-BUTIR PENOMORAN.
2. DILARANG memulai naskah langsung dengan angka "1." atau simbol bullet "-".
3. Kalimat pengantar harus merajut konteks dari sub-bab sebelumnya ke rumusan butir yang disajikan.`,
  },
  {
    slug: "piramida-terbalik",
    name: "Struktur Piramida Terbalik 8 Langkah",
    category: "STRUCTURAL",
    description: "Alur penulisan dari fenomena umum global/nasional, urgensi lapangan, studi terdahulu, kesenjangan penelitian (research gap), hingga fokus rumusan masalah.",
    systemPrompt: `ATURAN STRUKTUR PIRAMIDA TERBALIK:
1. Bangun alur naskah secara piramida terbalik: (a) Konsep fundamental topik, (b) Fenomena data riil & urgensi empiris, (c) Dampak jika masalah diabaikan, (d) Konteks objek studi, (e) Justifikasi pemilihan metode, (f) Telaah studi terdahulu sejenis, (g) Identifikasi research gap, (h) Kalimat jembatan penutup.
2. Setiap transisi paragraf harus mengalir logis mempersempit fokus hingga melahirkan rumusan masalah.`,
  },
  {
    slug: "roadmap-sistematika",
    name: "Sinkronisasi Roadmap Struktur Bab",
    category: "STRUCTURAL",
    description: "Format penulisan peta jalan dokumen skripsi dengan penomoran bab kapital dan deskripsi paragraf menjorok tanpa sitasi.",
    systemPrompt: `ATURAN STRUKTUR SISTEMATIKA PENULISAN (ROADMAP):
1. Format output WAJIB menampilkan heading bab huruf kapital tebal (contoh: "BAB I PENDAHULUAN"), diikuti 1-2 paragraf narasi deskriptif isi bab tersebut di bawahnya.
2. Seluruh bab wajib sinkron 1:1 dengan struktur Daftar Isi resmi skripsi.`,
  },
  {
    slug: "citation-empirical",
    name: "Kutipan Sitasi Empiris Presisi",
    category: "CITATION",
    description: "Wajib menyematkan nomor sitasi kurung siku [1], [2] yang persis merujuk pada nomor jurnal terverifikasi pada pool proyek.",
    systemPrompt: `ATURAN SITASI EMPIRIS KETAT:
1. Setiap klaim data, definisi konsep, temuan penelitian, dan komparasi studi terdahulu WAJIB mencantumkan sitasi kurung siku [1], [2], dst.
2. Nomor sitasi kurung siku HARUS PERSIS merujuk pada nomor indeks jurnal yang disediakan dalam konteks. Dilarang mengarang sitasi atau mengubah urutan rujukan!`,
  },
  {
    slug: "no-citation-allowed",
    name: "Bebas Sitasi (Strictly No Citations)",
    category: "CITATION",
    description: "Dilarang keras menyertakan sitasi kurung siku [1], [2] atau rujukan literatur apapun pada sub-bab operasional internal skripsi.",
    systemPrompt: `ATURAN STRICT TANPA SITASI:
1. DILARANG KERAS MENYERTAKAN SITASI, DAFTAR PUSTAKA, ATAU TANDA KURUNG SIKU [1], [2].
2. Sub-bab ini murni perumusan operasional internal, pengamatan objek studi, atau peta jalan dokumen peneliti sendiri.`,
  },
];

// ── 2. VARIAN PENDEKATAN PENELITIAN SPESIFIK ──
const APPROACH_VARIANTS = {
  "pendekatan-penelitian": [
    {
      approach: "KUANTITATIF",
      prompt: `PENDEKATAN PENELITIAN KUANTITATIF:
Jelaskan bahwa penelitian menggunakan paradigma kuantitatif deduktif-objektif. Uraikan pengujian hipotesis statistik, pengukuran variabel dengan data numerik terukur, penggunaan desain asosiatif/komparatif/eksplanatori, serta pengujian validitas konstruk dan reliabilitas instrumen.`
    },
    {
      approach: "KUALITATIF",
      prompt: `PENDEKATAN PENELITIAN KUALITATIF:
Jelaskan paradigma kualitatif induktif-interpretif yang membedah makna di balik fenomena secara mendalam (holistik). Uraikan posisi peneliti sebagai instrumen utama (human instrument), penggunaan triangulasi data (sumber, teknik, waktu), serta keterbukaan terhadap temuan naturalistik di lapangan.`
    },
    {
      approach: "EKSPERIMEN",
      prompt: `PENDEKATAN PENELITIAN EKSPERIMENTAL / TEKNOLOGI INFORMASI:
Jelaskan desain penelitian eksperimen rekayasa perangkat lunak / komputasi. Uraikan pembagian perlakuan (baseline vs model usulan), prosedur pengujian komparatif algoritma/arsitektur, matriks evaluasi kinerja (misal: akurasi, F1-Score, latensi komputasi, resource overhead), serta replikabilitas eksperimen.`
    },
    {
      approach: "CAMPURAN",
      prompt: `PENDEKATAN PENELITIAN MIXED METHODS:
Jelaskan desain metode campuran (misal: Sequential Explanatory atau Sequential Exploratory). Uraikan bagaimana fase kuantitatif dan kualitatif saling mengonfirmasi dan melengkapi untuk memberikan pemahaman fenomena yang utuh.`
    },
    {
      approach: "DESKRIPTIF",
      prompt: `PENDEKATAN PENELITIAN DESKRIPTIF:
Jelaskan pendekatan deskriptif sistematis yang memotret karakteristik fenomena atau status variabel saat ini secara faktual dan akurat tanpa melakukan manipulasi variabel independen.`
    },
    {
      approach: "EMPIRIS",
      prompt: `PENDEKATAN PENELITIAN EMPIRIS:
Jelaskan pendekatan studi empiris berbasis observasi lapangan langsung atau data sekunder riil industri/organisasi, menekankan evidensi faktual dari proses implementasi sistem.`
    },
  ],
  "analisis-data": [
    {
      approach: "KUANTITATIF",
      prompt: `TEKNIK ANALISIS DATA KUANTITATIF:
Uraikan langkah analisis data secara berurutan: (1) Analisis statistik deskriptif, (2) Uji asumsi klasik (normalitas, linearitas, multikolinearitas, heteroskedastisitas jika regresi), (3) Uji hipotesis (regresi berganda / SEM-PLS / t-test) dengan tingkat signifikansi alpha = 0.05, (4) Koefisien determinasi R-Square.`
    },
    {
      approach: "KUALITATIF",
      prompt: `TEKNIK ANALISIS DATA KUALITATIF:
Gunakan model analisis interaktif (Miles, Huberman, & Saldana): (1) Kondensasi data (data condensation) dari transkrip wawancara dan catatan lapangan, (2) Penyajian data (data display) dalam bentuk matriks/narasi tematik, (3) Penarikan kesimpulan dan verifikasi (drawing/verifying conclusions).`
    },
    {
      approach: "EKSPERIMEN",
      prompt: `TEKNIK ANALISIS & EVALUASI EKSPERIMEN REKAYASA:
Uraikan metrik evaluasi kuantitatif sistem/model: (1) Confusion matrix, Accuracy, Precision, Recall, F1-Score, AUC-ROC, (2) Benchmark latensi respon (ms) dan konsumsi memori (MB), (3) Uji komparasi performa model usulan terhadap baseline benchmark state-of-the-art.`
    },
    {
      approach: "CAMPURAN",
      prompt: `TEKNIK ANALISIS DATA MIXED METHODS:
Jelaskan teknik integrasi data: analisis kuantitatif dilakukan terlebih dahulu untuk memetakan pola numerik, dilanjutkan analisis kualitatif koding tematik untuk menguak alasan mendalam di balik pola kuantitatif tersebut.`
    },
  ],
  "pengumpulan-data": [
    {
      approach: "KUANTITATIF",
      prompt: `TEKNIK PENGUMPULAN DATA KUANTITATIF:
Fokuskan pada kuesioner terstruktur dengan skala Likert 5 poin yang telah diuji validitas dan reliabilitasnya, serta data sekunder dokumentasi resmi.`
    },
    {
      approach: "KUALITATIF",
      prompt: `TEKNIK PENGUMPULAN DATA KUALITATIF:
Gunakan wawancara mendalam semi-terstruktur (in-depth interview) dengan pedoman wawancara fleksibel, observasi partisipatif, studi dokumentasi naskah otentik, serta Focus Group Discussion (FGD).`
    },
    {
      approach: "EKSPERIMEN",
      prompt: `TEKNIK PENGUMPULAN DATASET & TELEMETRI EKSPERIMEN:
Uraikan teknik pengambilan dataset sekunder benchmark publik (Kaggle/UCI/HuggingFace) atau perekaman data primer telemetri log sistem secara otomatis via API/sensor/skrip crawler.`
    },
  ],
  "landasan-teori": [
    {
      approach: "KUANTITATIF",
      prompt: `LANDASAN TEORI KUANTITATIF:
Uraikan grand theory pendukung, pembagian teori per variabel penelitian (Variabel Independen X, Dependen Y, Mediasi/Moderasi), serta operasionalisasi hubungan kausalitas antar variabel.`
    },
    {
      approach: "KUALITATIF",
      prompt: `LANDASAN TEORI KUALITATIF:
Kaji konsep-konsep sentral fenomena secara holistik sebagai 'lensa konseptual' (conceptual lens) untuk menuntun penjelajahan di lapangan tanpa membatasi temuan baru.`
    },
    {
      approach: "EKSPERIMEN",
      prompt: `LANDASAN TEORI REKAYASA SISTEM / ALGORITMA:
Uraikan teori dasar algoritma komputasi, formulasi matematis, arsitektur model, dan prinsip rekayasa perangkat lunak yang melandasi solusi teknologi yang diajukan.`
    },
  ],
};

// ── 3. FUNGSI MIGRASI UTAMA ──
export async function migrateSubchaptersToRules() {
  console.log("🚀 Memulai migrasi Sub-bab ke Rules, Varian & Output Spec...");

  // 1. Upsert Core Global Rules
  console.log("📦 1. Mengimpor Core Global Rules...");
  const coreRuleMap = new Map();
  for (const r of CORE_GLOBAL_RULES) {
    const upserted = await prisma.rule.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        category: r.category,
        description: r.description,
        systemPrompt: r.systemPrompt,
        isActive: true,
        isSystem: true,
      },
      create: {
        slug: r.slug,
        name: r.name,
        category: r.category,
        description: r.description,
        systemPrompt: r.systemPrompt,
        isActive: true,
        isSystem: true,
      },
    });
    coreRuleMap.set(r.slug, upserted);
    console.log(`   ✓ Rule [${r.slug}] tersimpan`);
  }

  // 2. Iterasi seluruh 24 sub-bab
  console.log(`\n📚 2. Mengolah 24 spesifikasi sub-bab dari registri...`);

  for (let i = 0; i < ALL_SUBCHAPTER_SPECS.length; i++) {
    const spec = ALL_SUBCHAPTER_SPECS[i];
    const tag = spec.slug;
    const title = spec.defaultTitle;
    const cluster = spec.cluster || "BAB_1";

    let babNumber = 1;
    if (cluster === "DOCS") babNumber = 0;
    else if (cluster === "BAB_1") babNumber = 1;
    else if (cluster === "BAB_2") babNumber = 2;
    else if (cluster === "BAB_3") babNumber = 3;

    // A. Upsert SubBab
    const subBab = await prisma.subBab.upsert({
      where: { tag },
      update: {
        title,
        bab: babNumber,
        order: i + 1,
      },
      create: {
        tag,
        title,
        bab: babNumber,
        order: i + 1,
      },
    });

    // B. Upsert OutputSpec
    const formatStyle = spec.paper?.rules?.formatStyle || "PARAGRAPH";
    const citationPolicy = spec.paper?.rules?.citationMode || (spec.paper?.rules?.citationRequired ? "REQUIRED" : "OPTIONAL");
    const jsonSchema = spec.paper?.jsonSchema || null;
    const renderTemplate = spec.paper?.previewExample?.renderedDraft || null;

    await prisma.outputSpec.upsert({
      where: { subBabId: subBab.id },
      update: {
        formatStyle,
        citationPolicy,
        jsonSchema,
        renderTemplate,
      },
      create: {
        subBabId: subBab.id,
        formatStyle,
        citationPolicy,
        jsonSchema,
        renderTemplate,
      },
    });

    // C. Buat Rule Sub-bab Spesifik
    const ruleSlug = `rule-${tag}`;
    const baseSystemPrompt = spec.outline?.systemPrompt || `Anda adalah Metodolog Skripsi Ahli untuk menyusun sub-bab ${title}.`;

    const subBabRule = await prisma.rule.upsert({
      where: { slug: ruleSlug },
      update: {
        name: `Panduan Standar Sub-bab: ${title}`,
        category: "STRUCTURAL",
        description: `Instruksi pemodelan draf akademis baku untuk sub-bab ${title}.`,
        systemPrompt: baseSystemPrompt,
        isActive: true,
        isSystem: true,
      },
      create: {
        slug: ruleSlug,
        name: `Panduan Standar Sub-bab: ${title}`,
        category: "STRUCTURAL",
        description: `Instruksi pemodelan draf akademis baku untuk sub-bab ${title}.`,
        systemPrompt: baseSystemPrompt,
        isActive: true,
        isSystem: true,
      },
    });

    // D. Buat Varian Pendekatan jika ada
    if (APPROACH_VARIANTS[tag]) {
      for (const v of APPROACH_VARIANTS[tag]) {
        await prisma.ruleVariant.upsert({
          where: {
            ruleId_researchApproach: {
              ruleId: subBabRule.id,
              researchApproach: v.approach,
            },
          },
          update: {
            systemPrompt: v.prompt,
          },
          create: {
            ruleId: subBabRule.id,
            researchApproach: v.approach,
            systemPrompt: v.prompt,
          },
        });
      }
      console.log(`   + Menambahkan ${APPROACH_VARIANTS[tag].length} varian riset ke rule [${ruleSlug}]`);
    }

    // E. Pasang Mappings SubBab ↔ Rules (N:N)
    // Hapus mapping lama untuk sub-bab ini
    await prisma.subBabRuleMapping.deleteMany({
      where: { subBabId: subBab.id },
    });

    const rulesToAttach = [];

    // 1. Rule spesifik sub-bab selalu di urutan 1
    rulesToAttach.push({ ruleId: subBabRule.id, isRequired: true });

    // 2. Anti AI-Slop & EYD V selalu dipasang untuk seluruh sub-bab
    if (coreRuleMap.has("wiriting-ai-slop")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("wiriting-ai-slop").id, isRequired: true });
    }
    if (coreRuleMap.has("eyd-v")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("eyd-v").id, isRequired: true });
    }

    // 3. Aturan struktural spesifik
    if (tag === "latar-belakang" && coreRuleMap.has("piramida-terbalik")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("piramida-terbalik").id, isRequired: true });
    }
    if (tag === "sistematika-penulisan" && coreRuleMap.has("roadmap-sistematika")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("roadmap-sistematika").id, isRequired: true });
    }
    if (spec.paper?.rules?.introSentenceRequired && coreRuleMap.has("intro-sentence")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("intro-sentence").id, isRequired: true });
    }

    // 4. Aturan Sitasi
    if (citationPolicy === "NONE" && coreRuleMap.has("no-citation-allowed")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("no-citation-allowed").id, isRequired: true });
    } else if (citationPolicy === "REQUIRED" && coreRuleMap.has("citation-empirical")) {
      rulesToAttach.push({ ruleId: coreRuleMap.get("citation-empirical").id, isRequired: true });
    }

    // Tulis mapping
    for (let mIdx = 0; mIdx < rulesToAttach.length; mIdx++) {
      const item = rulesToAttach[mIdx];
      await prisma.subBabRuleMapping.create({
        data: {
          subBabId: subBab.id,
          ruleId: item.ruleId,
          order: mIdx + 1,
          isRequired: item.isRequired,
        },
      });
    }

    console.log(`   ✓ Sub-bab [${subBab.tag}] siap dengan ${rulesToAttach.length} rules dipetakan (Format: ${formatStyle}, Sitasi: ${citationPolicy})`);
  }

  console.log("\n🎉 Migrasi selesai sukses! Seluruh SubBab, Rules, Varian, dan OutputSpec telah aktif.");
}

// Eksekusi langsung jika dipanggil via CLI
if (process.argv[1]?.includes("migrate-subchapters-to-rules.js")) {
  migrateSubchaptersToRules()
    .catch((err) => {
      console.error("❌ Error saat migrasi:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
