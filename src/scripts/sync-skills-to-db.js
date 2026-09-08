import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Sinkronisasi Skills dari .agents/skills ke Database & Admin Panel ===");

  // ─────────────────────────────────────────────────────────────
  // 1. RULE: wiriting-ai-slop (WRITING_STYLE)
  // ─────────────────────────────────────────────────────────────
  const aiSlopBasePrompt = `ATURAN GAYA PENULISAN (ANTI AI-SLOP & FORMALITAS AKADEMIK INDONESIA 2026):
1. PRINSIP UTAMA:
   Tulisan AI gagal karena mengoptimalkan probabilitas statistik yang menghasilkan teks datar, klise, dan seragam. Tulisan akademis sejati memiliki spesifisitas tinggi, kedalaman sintaksis, dan ritme manusia yang alami.
2. ATURAN MUTLAK NOL DASH (EM DASH & EN DASH DILARANG TOTAL):
   - Em dash (—) dan en dash (–) DILARANG SEPENUHNYA (NOL BESAR).
   - Ganti dengan: titik untuk memecah kalimat, koma, titik dua, atau tanda kurung.
   - Untuk rentang angka/tahun gunakan tanda hubung biasa (misal: 2020-2025) atau kata "sampai".
3. DILARANG PEMBUKA KLISE ROBOTIK:
   - Dilarang membuka dengan: "Di era modern ini", "Seiring perkembangan zaman/teknologi", "Dalam konteks X yang semakin Y", "Perlu diketahui bahwa", "Tidak dapat dipungkiri bahwa", "Di era digital saat ini".
   - Awali paragraf langsung dengan: fakta empiris, data kuantitatif, atau konsep spesifik yang menjadi pokok bahasan.
4. DILARANG PENUTUP BOILERPLATE:
   - Dilarang menutup dengan: "Sebagai kesimpulan,", "Dapat disimpulkan bahwa", "Secara keseluruhan,", "Pada akhirnya,", "Satu hal yang pasti,".
   - Tutup tulisan dengan ketegasan posisi argumentatif atau implikasi ilmiah konkret.
5. DILARANG PUFFERY & KATA KERJA KLISE AI:
   - Hindari kata puffery: "sangat krusial", "fundamental", "komprehensif", "holistik", "inovatif", "dinamis", "ekosistem", "paradigma", "optimalisasi", "transformasi digital", "lanskap".
   - Hindari kata kerja klise AI: "menyelami" (delve), "menyoroti pentingnya", "menggarisbawahi signifikansi", "memfasilitasi", "mengedepankan", "berperan penting dalam membentuk".
6. DILARANG PASANGAN FORMULAIK:
   - Hindari klise: "tantangan dan peluang", "di satu sisi... di sisi lain...", "tidak hanya X, tetapi juga Y", "kelebihan dan kekurangan".
7. DILARANG ATRIBUSI SAMAR TANPA RUJUKAN:
   - Hindari: "Para ahli berpendapat,", "Penelitian menunjukkan,", "Banyak pihak meyakini,".
   - Wajib sebutkan nama peneliti, tahun terbit, dan lokus empiris riil.
8. BURSTINESS & VARIASI KALIMAT TINGGI:
   - Jangan menyusun 3 kalimat berturut-turut dengan panjang serupa (15-20 kata). Campur kalimat pendek tegas (4-8 kata) dengan kalimat penjelas kompleks (20-30 kata).
9. REGISTER FORMAL TIER 1:
   - Gunakan sudut pandang orang ketiga ("penulis", "peneliti", atau konstruksi kalimat pasif formal: "dilakukan", "ditemukan", "diuji"). Hindari kata ganti informal ("saya", "kita", "kamu").
   - Bahasa baku sesuai kaidah EYD V / PUEBI, bernas, padat makna, dan langsung pada pokok substansi.`;

  const aiSlopRule = await prisma.rule.upsert({
    where: { slug: "wiriting-ai-slop" },
    update: {
      name: "Anti AI-Slop & Gaya Akademis Baku",
      category: "WRITING_STYLE",
      description: "Mencegah basa-basi klise robotik AI, menegakkan kebijakan zero em-dash, burstiness tinggi, dan formulasi kalimat akademis baku berbasis EYD V.",
      systemPrompt: aiSlopBasePrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "wiriting-ai-slop",
      name: "Anti AI-Slop & Gaya Akademis Baku",
      category: "WRITING_STYLE",
      description: "Mencegah basa-basi klise robotik AI, menegakkan kebijakan zero em-dash, burstiness tinggi, dan formulasi kalimat akademis baku berbasis EYD V.",
      systemPrompt: aiSlopBasePrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log(`[Rule] wiriting-ai-slop tersimpan (ID: ${aiSlopRule.id})`);

  // Varian wiriting-ai-slop per pendekatan riset
  const aiSlopVariants = [
    {
      researchApproach: "KUANTITATIF",
      systemPrompt: `${aiSlopBasePrompt}

KHUSUS PENDEKATAN KUANTITATIF:
- Fokuskan ekspresi ilmiah pada data numerik, signifikansi statistik, hubungan fungsional antar-variabel, dan hasil ukur instrumen terstandar.
- Gunakan terminologi operasional presisi: sampel representatif, taraf signifikansi (p < 0,05), koefisien determinasi, validitas konstruk, dan reliabilitas instrumen.
- Hindari opini subjektif tanpa sokongan data frekuensi atau metrik pengukuran yang nyata.`,
    },
    {
      researchApproach: "KUALITATIF",
      systemPrompt: `${aiSlopBasePrompt}

KHUSUS PENDEKATAN KUALITATIF:
- Gunakan deskripsi tebal (thick description) yang mendalam, kontekstual, dan menghargai suara informan di lapangan.
- Sajikan narasi ilmiah yang merefleksikan makna mendalam dari wawancara, observasi partisipatif, dan analisis tematik.
- Terapkan prinsip keabsahan data: triangulasi sumber, triangulasi teknik, perpanjangan pengamatan, dan auditabilitas analisis tanpa menggunakan kata klise generik AI.`,
    },
    {
      researchApproach: "CAMPURAN",
      systemPrompt: `${aiSlopBasePrompt}

KHUSUS PENDEKATAN METODE CAMPURAN (MIXED METHODS):
- Jalin integrasi naratif antara pola data kuantitatif dengan temuan eksploratif kualitatif secara kohesif.
- Gunakan kerangka sekuensial atau konvergen yang jelas: data numerik memperlihatkan tren makro, sementara telaah kualitatif membongkar alasan kausal di baliknya.
- Hindari pemisahan kaku yang terputus; pastikan konvergensi temuan disintesis menjadi kesatuan pemahaman riset yang utuh.`,
    },
    {
      researchApproach: "EKSPERIMEN",
      systemPrompt: `${aiSlopBasePrompt}

KHUSUS PENDEKATAN EKSPERIMEN & REKAYASA SISTEM:
- Formulasikan kalimat ilmiah yang tegas mengenai perancangan arsitektur, parameter pengujian, kondisi kontrol versus perlakuan eksperimen.
- Gunakan metrik performa teknis spesifik (akurasi, presisi, recall, F1-score, latensi respon milidetik, throughput komputasi).
- Analisis perbandingan dengan metode baseline terdahulu secara objektif tanpa hiperbola atau klaim sepihak tanpa data pengujian.`,
    },
  ];

  for (const v of aiSlopVariants) {
    await prisma.ruleVariant.upsert({
      where: {
        ruleId_researchApproach: {
          ruleId: aiSlopRule.id,
          researchApproach: v.researchApproach,
        },
      },
      update: { systemPrompt: v.systemPrompt },
      create: {
        ruleId: aiSlopRule.id,
        researchApproach: v.researchApproach,
        systemPrompt: v.systemPrompt,
      },
    });
  }
  console.log(`[Variants] 4 Varian terpasang untuk wiriting-ai-slop`);

  // ─────────────────────────────────────────────────────────────
  // 2. RULE: latar-belakang-skripsi (STRUCTURAL)
  // ─────────────────────────────────────────────────────────────
  const latarBelakangBasePrompt = `PEDOMAN STRUKTURAL PENYUSUNAN 1.1 LATAR BELAKANG (PIRAMIDA TERBALIK):
1. STRUKTUR 5 PARAGRAF NARATIF BERKESINAMBUNGAN:
   - Paragraf 1 (Konsep & Teori Utama): Membuka ranah keilmuan topik dengan definisi dan teori fundamental dari literatur otoritatif.
   - Paragraf 2 (Fenomena & Data Empiris Lapangan): Memaparkan kondisi riil, bukti empiris, tren masalah faktual, dan data statistik aktual (BPS, asosiasi, atau data lapangan).
   - Paragraf 3 (Dampak Masalah & Urgensi Riset): Menguraikan konsekuensi akademis maupun praktis jika masalah tidak segera diselesaikan, menegaskan mengapa riset mendesak dilakukan saat ini.
   - Paragraf 4 (Telaah Penelitian Terdahulu & Research Gap): Membedah 3-4 artikel jurnal sejenis terdahulu (peneliti, tahun, metode, temuan) dan menunjukkan celah riset (gap) yang belum terselesaikan.
   - Paragraf 5 (Penegasan Solusi & Novelty Riset): Menegaskan kebaruan gagasan peneliti, pendekatan metode yang diusulkan, objek/lokus spesifik, dan kontribusi yang ditawarkan.
2. PANJANG & TARGET KATA:
   - Target naskah: 900 - 1.500 kata (2,5 - 4 halaman A4 standar skripsi spasi 1.5).
   - Setiap paragraf berisi 5-8 kalimat padat makna dengan kohesi antar-paragraf yang mengalir lancar.
3. KETENTUAN KHUSUS:
   - Dilarang membuat sub-judul atau penomoran di dalam Sub-bab 1.1. Seluruh latar belakang harus berupa alur paragraf naratif utuh.
   - Terapkan kebijakan nol dash (tanpa em-dash maupun en-dash).
   - Seluruh kutipan jurnal menggunakan penomoran sitasi yang presisi sesuai rujukan yang tersedia.`;

  const latarBelakangRule = await prisma.rule.upsert({
    where: { slug: "latar-belakang-skripsi" },
    update: {
      name: "Struktur Latar Belakang Piramida Terbalik",
      category: "STRUCTURAL",
      description: "Menyusun alur 1.1 Latar Belakang Masalah dengan piramida terbalik 5 tahap (Konsep -> Fenomena Empiris -> Urgensi -> Riset Terdahulu & Gap -> Penegasan Solusi), target 900-1500 kata.",
      systemPrompt: latarBelakangBasePrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "latar-belakang-skripsi",
      name: "Struktur Latar Belakang Piramida Terbalik",
      category: "STRUCTURAL",
      description: "Menyusun alur 1.1 Latar Belakang Masalah dengan piramida terbalik 5 tahap (Konsep -> Fenomena Empiris -> Urgensi -> Riset Terdahulu & Gap -> Penegasan Solusi), target 900-1500 kata.",
      systemPrompt: latarBelakangBasePrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log(`[Rule] latar-belakang-skripsi tersimpan (ID: ${latarBelakangRule.id})`);

  const latarBelakangVariants = [
    {
      researchApproach: "KUANTITATIF",
      systemPrompt: `${latarBelakangBasePrompt}

PENYESUAIAN PENDEKATAN KUANTITATIF:
- Pada Paragraf 2, tekankan kesenjangan statistik atau inkonsistensi besaran koefisien dari laporan resmi atau temuan sebelumnya.
- Pada Paragraf 4, ulas perbedaan temuan antar-peneliti terdahulu dalam menguji pengaruh variabel X terhadap variabel Y.
- Pada Paragraf 5, tegaskan hubungan kausalitas atau asosiatif yang akan diuji secara empiris menggunakan instrumen terukur.`,
    },
    {
      researchApproach: "KUALITATIF",
      systemPrompt: `${latarBelakangBasePrompt}

PENYESUAIAN PENDEKATAN KUALITATIF:
- Pada Paragraf 2, soroti dinamika sosial, kompleksitas perilaku, atau keunikan fenomena di lokus penelitian yang belum terjelaskan secara memadai.
- Pada Paragraf 4, tunjukkan keterbatasan studi literatur yang ada karena terlalu menyederhanakan konteks lokal atau mengabaikan perspektif subjek yang diteliti.
- Pada Paragraf 5, tegaskan tujuan eksplorasi makna, konstruksi realitas, atau penemuan model teoretis baru dari sudut pandang informan.`,
    },
    {
      researchApproach: "CAMPURAN",
      systemPrompt: `${latarBelakangBasePrompt}

PENYESUAIAN PENDEKATAN METODE CAMPURAN:
- Pada Paragraf 2, paparkan bukti bahwa data kuantitatif saja belum cukup menjelaskan kedalaman fenomena, atau sebaliknya temuan kualitatif memerlukan pembuktian skala luas.
- Pada Paragraf 4, identifikasi kebutuhan integrasi sekuensial yang belum dipenuhi oleh riset-riset sebelumnya.
- Pada Paragraf 5, tegaskan desain integrasi (explanatory sequential atau exploratory sequential) yang akan mengungkap baik tren angka maupun dinamika naratifnya.`,
    },
    {
      researchApproach: "EKSPERIMEN",
      systemPrompt: `${latarBelakangBasePrompt}

PENYESUAIAN PENDEKATAN EKSPERIMEN & REKAYASA TEKNOLOGI:
- Pada Paragraf 2, uraikan kegagalan performa sistem saat ini, keterbatasan komputasi, atau inefisiensi arsitektur eksisting pada skenario dunia nyata.
- Pada Paragraf 4, bedah kelemahan algoritma/metode baseline terdahulu (misalnya overfitting pada data minoritas, latensi tinggi, atau penurunan akurasi).
- Pada Paragraf 5, tegaskan kontribusi teknis arsitektur baru yang diusulkan dan hipotesis peningkatan performa yang akan divalidasi secara eksperimental.`,
    },
  ];

  for (const v of latarBelakangVariants) {
    await prisma.ruleVariant.upsert({
      where: {
        ruleId_researchApproach: {
          ruleId: latarBelakangRule.id,
          researchApproach: v.researchApproach,
        },
      },
      update: { systemPrompt: v.systemPrompt },
      create: {
        ruleId: latarBelakangRule.id,
        researchApproach: v.researchApproach,
        systemPrompt: v.systemPrompt,
      },
    });
  }
  console.log(`[Variants] 4 Varian terpasang untuk latar-belakang-skripsi`);

  // ─────────────────────────────────────────────────────────────
  // 3. RULE: ieee-scopus-grounding (CITATION)
  // ─────────────────────────────────────────────────────────────
  const groundingBasePrompt = `PROTOKOL SITASI BEREPUTASI TINGGI (IEEE / SCOPUS / SINTA BERBASIS GROUNDING RIIL):
1. PRINSIP INTEGRITAS ILMIAH TANPA HALUSINASI (ZERO FAKE CITATION):
   - Seluruh rujukan yang dikutip ke dalam naskah WAJIB berasal dari daftar jurnal terverifikasi yang disediakan di dalam proyek.
   - DILARANG KERAS mengarang nama peneliti, judul artikel, tahun publikasi, atau nomor DOI palsu.
   - DILARANG merekayasa angka persentase atau metrik evaluasi tanpa ada sumber dokumen rujukan yang nyata.
2. STANDAR REPUTASI SUMBER RUJUKAN:
   - Prioritaskan rujukan terindeks Scopus (Q1-Q4), IEEE Xplore, ACM Digital Library, ScienceDirect, atau SINTA Peringkat 1-2.
   - Minimal 80% rujukan terbit dalam 5 tahun terakhir untuk menjamin kebaruan literatur (state-of-the-art).
3. ATURAN PENYEBUTAN SITASI DALAM TEKS:
   - Untuk format numerik (IEEE / Vancouver): Gunakan tanda kurung siku sesuai nomor urut jurnal di daftar proyek, contoh: [1], [2], [1, 3].
   - Untuk format alfabetik (APA / Harvard): Gunakan format nama akhir penulis dan tahun, contoh: (Siti dkk., 2024) atau Menurut Pratama (2023)...
4. SINTESIS DAN PARAFRASE TEMUAN:
   - Dilarang menyalin (copy-paste) kalimat secara mentah. Rangkum ide pokok, metode utama, serta temuan empiris artikel dengan formulasi kalimat akademis sendiri.
   - Setiap kali mengutip temuan spesifik, langsung sandingkan dengan implikasi ilmiah terhadap topik skripsi peneliti.`;

  const groundingRule = await prisma.rule.upsert({
    where: { slug: "ieee-scopus-grounding" },
    update: {
      name: "Landasan Ilmiah IEEE, Scopus & SINTA",
      category: "CITATION",
      description: "Menegakkan rujukan primer bereputasi (IEEE Xplore, Scopus Q1-Q4, SINTA 1-2) dengan validitas DOI nyata, anti-halusinasi sitasi, dan sintesis temuan empiris.",
      systemPrompt: groundingBasePrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "ieee-scopus-grounding",
      name: "Landasan Ilmiah IEEE, Scopus & SINTA",
      category: "CITATION",
      description: "Menegakkan rujukan primer bereputasi (IEEE Xplore, Scopus Q1-Q4, SINTA 1-2) dengan validitas DOI nyata, anti-halusinasi sitasi, dan sintesis temuan empiris.",
      systemPrompt: groundingBasePrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log(`[Rule] ieee-scopus-grounding tersimpan (ID: ${groundingRule.id})`);

  const groundingVariants = [
    {
      researchApproach: "KUANTITATIF",
      systemPrompt: `${groundingBasePrompt}

PENYESUAIAN PENDEKATAN KUANTITATIF:
- Prioritaskan sitasi jurnal yang menyajikan instrumen pengukuran teruji, ukuran sampel memadai, nilai reliabilitas (Cronbach's Alpha), dan nilai koefisien regresi/korelasi yang sahih.
- Kutip artikel rujukan untuk memperkuat justifikasi pemilihan skala pengukuran dan teknik uji statistik yang digunakan.`,
    },
    {
      researchApproach: "KUALITATIF",
      systemPrompt: `${groundingBasePrompt}

PENYESUAIAN PENDEKATAN KUALITATIF:
- Prioritaskan sitasi jurnal yang menggunakan metodologi kualitatif terkemuka (studi kasus mendalam, fenomenologi, atau grounded theory) dengan bukti triangulasi yang kuat.
- Tautkan rujukan ilmiah untuk mendukung konseptualisasi tema dan pemaknaan fenomena yang diteliti.`,
    },
    {
      researchApproach: "CAMPURAN",
      systemPrompt: `${groundingBasePrompt}

PENYESUAIAN PENDEKATAN METODE CAMPURAN:
- Prioritaskan rujukan jurnal bereputasi yang telah berhasil menerapkan model integrasi mixed-methods sejenis.
- Gunakan rujukan untuk melegitimasi prosedur pembobotan, sampling terpadu, dan strategi validasi silang antar metode.`,
    },
    {
      researchApproach: "EKSPERIMEN",
      systemPrompt: `${groundingBasePrompt}

PENYESUAIAN PENDEKATAN EKSPERIMEN:
- Prioritaskan artikel dari IEEE Xplore, ACM, atau jurnal terindeks Scopus Q1-Q2 yang mempublikasikan benchmark dataset, parameter hyperparameter, dan arsitektur pembanding mutakhir.
- Sertakan metrik perbandingan kuantitatif riil dari literatur pembanding sebagai dasar penentuan target performa eksperimen peneliti.`,
    },
  ];

  for (const v of groundingVariants) {
    await prisma.ruleVariant.upsert({
      where: {
        ruleId_researchApproach: {
          ruleId: groundingRule.id,
          researchApproach: v.researchApproach,
        },
      },
      update: { systemPrompt: v.systemPrompt },
      create: {
        ruleId: groundingRule.id,
        researchApproach: v.researchApproach,
        systemPrompt: v.systemPrompt,
      },
    });
  }
  console.log(`[Variants] 4 Varian terpasang untuk ieee-scopus-grounding`);

  // ─────────────────────────────────────────────────────────────
  // 4. PASANG KE SUB-BAB TERKAIT (SubBabRuleMapping)
  // ─────────────────────────────────────────────────────────────
  const allSubBabs = await prisma.subBab.findMany();
  console.log(`Total sub-bab di database: ${allSubBabs.length}`);

  let mappedCount = 0;
  for (const sb of allSubBabs) {
    // Pastikan wiriting-ai-slop terpasang di SEMUA sub-bab
    await prisma.subBabRuleMapping.upsert({
      where: {
        subBabId_ruleId: {
          subBabId: sb.id,
          ruleId: aiSlopRule.id,
        },
      },
      update: { isRequired: true, order: 0 },
      create: {
        subBabId: sb.id,
        ruleId: aiSlopRule.id,
        isRequired: true,
        order: 0,
      },
    });
    mappedCount++;

    // Jika sub-bab adalah Latar Belakang (tag: latar_belakang atau judul memuat Latar Belakang)
    if (sb.tag.includes("latar") || sb.title.toLowerCase().includes("latar belakang")) {
      await prisma.subBabRuleMapping.upsert({
        where: {
          subBabId_ruleId: {
            subBabId: sb.id,
            ruleId: latarBelakangRule.id,
          },
        },
        update: { isRequired: true, order: 1 },
        create: {
          subBabId: sb.id,
          ruleId: latarBelakangRule.id,
          isRequired: true,
          order: 1,
        },
      });

      await prisma.subBabRuleMapping.upsert({
        where: {
          subBabId_ruleId: {
            subBabId: sb.id,
            ruleId: groundingRule.id,
          },
        },
        update: { isRequired: true, order: 2 },
        create: {
          subBabId: sb.id,
          ruleId: groundingRule.id,
          isRequired: true,
          order: 2,
        },
      });
    }

    // Jika sub-bab adalah Kajian Pustaka, Landasan Teori, atau Penelitian Terdahulu
    if (
      sb.tag.includes("teori") ||
      sb.tag.includes("pustaka") ||
      sb.title.toLowerCase().includes("teori") ||
      sb.title.toLowerCase().includes("pustaka") ||
      sb.title.toLowerCase().includes("terdahulu") ||
      sb.title.toLowerCase().includes("kerangka")
    ) {
      await prisma.subBabRuleMapping.upsert({
        where: {
          subBabId_ruleId: {
            subBabId: sb.id,
            ruleId: groundingRule.id,
          },
        },
        update: { isRequired: true, order: 1 },
        create: {
          subBabId: sb.id,
          ruleId: groundingRule.id,
          isRequired: true,
          order: 1,
        },
      });
    }
  }

  console.log(`Berhasil memasangkan rules ke seluruh sub-bab. Sinkronisasi tuntas!`);
}

main()
  .catch((e) => {
    console.error("Gagal sinkronisasi skills:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
