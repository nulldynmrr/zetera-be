import prisma from "../lib/prisma.js";

async function main() {
  console.log("🚀 Memulai upgrade sistem skills: Writing Anti-Slop, Latar Belakang Skripsi, & IEEE/Scopus Grounding...");

  // 1. Rule: writing-ai-slop (Anti-Slop AI Writing 2026)
  const antiSlopPrompt = `ATURAN MUTLAK GAYA BAHASA (ANTI-AI SLOP 2026):
1. KEBIJAKAN NOL DASH (STRICT ZERO-DASH): DILARANG KERAS menggunakan tanda pisah em dash (—) ataupun en dash (–) di seluruh naskah! Ganti dengan tanda titik (pecah kalimat), koma, titik dua, atau tanda kurung. Gunakan tanda hubung biasa (-) hanya untuk rentang angka atau kata ulang.
2. DILARANG PEMBUKA KLISE: Dilarang keras mengawali paragraf dengan frasa usang seperti "Di era modern ini", "Seiring perkembangan zaman/teknologi", "Dalam konteks [X] yang semakin [Y]", "Perlu diketahui bahwa", atau "Tidak dapat dipungkiri". Awali langsung dengan fakta empiris, data kuantitatif, atau konsep spesifik!
3. DILARANG PENUTUP BOILERPLATE: Dilarang keras menggunakan "Sebagai kesimpulan,", "Dapat disimpulkan bahwa,", "Secara keseluruhan,", "Pada akhirnya,", atau "Satu hal yang pasti,". Akhiri bagian dengan posisi argumen yang tegas atau fakta konkret penutup.
4. DILARANG PUFFERY & KATA KERJA KLISE AI: Jangan gunakan "sangat krusial", "fundamental", "komprehensif", "holistik", "inovatif", "transformasi digital", "ekosistem", "paradigma", "optimalisasi", "menyelami", "menyoroti pentingnya", "menggarisbawahi signifikansi", atau "berperan penting dalam membentuk". Gunakan kata kerja konkret yang langsung menyatakan aksi.
5. DILARANG PASANGAN FORMULAIK: Jangan memasangkan "tantangan dan peluang", "di satu sisi... di sisi lain", "tidak hanya X tetapi juga Y".
6. DILARANG ATRIBUSI SAMAR: Jangan gunakan "para ahli menyatakan", "penelitian menunjukkan", "banyak pihak berpendapat" tanpa menyebutkan nama peneliti dan tahun publikasinya.
7. VARIASI PANJANG KALIMAT (BURSTINESS ALAMI): Campurkan kalimat pendek (4-7 kata) dengan kalimat panjang (20-30 kata). Dilarang menulis 3 kalimat berturut-turut dengan panjang seragam 17-23 kata.
8. REGISTER AKADEMIK BAKU FORMAL (TIER 1): Gunakan Bahasa Indonesia formal sesuai EYD V. Gunakan istilah impersonal ("peneliti", "penulis", atau kalimat pasif wajar) dan hindari kata ganti orang pertama santai.`;

  const ruleAntiSlop = await prisma.rule.upsert({
    where: { slug: "wiriting-ai-slop" },
    update: {
      name: "Anti-AI Slop Writing Engine (2026 Edition)",
      description: "Menjamin naskah bebas dari pola probabilitas AI, bebas tanda em-dash (—), bebas klise pembuka/penutup, dan memiliki burstiness alami.",
      category: "WRITING_STYLE",
      systemPrompt: antiSlopPrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "wiriting-ai-slop",
      name: "Anti-AI Slop Writing Engine (2026 Edition)",
      description: "Menjamin naskah bebas dari pola probabilitas AI, bebas tanda em-dash (—), bebas klise pembuka/penutup, dan memiliki burstiness alami.",
      category: "WRITING_STYLE",
      systemPrompt: antiSlopPrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log("✓ Rule Anti-Slop diperbarui:", ruleAntiSlop.slug);

  // 2. Rule: latar-belakang-skripsi (Baku Mutu Piramida Terbalik 5 Tahap)
  const latarBelakangPrompt = `PEDOMAN PENYUSUNAN 1.1 LATAR BELAKANG MASALAH (PIRAMIDA TERBALIK 5 TAHAP):
Naskah Latar Belakang disusun dalam paragraf naratif yang mengalir (umum menuju khusus) tanpa sub-judul di dalamnya:
- Paragraf 1 (Konsep & Teori Utama): Definisikan konsep fundamental dan variabel riset terkait topik {{TOPIC}} berdasarkan teori otoritatif.
- Paragraf 2 (Fenomena & Data Empiris Terkini): Sajikan data tren, bukti statistik nyata, atau fakta empiris lapangan yang menunjukkan adanya masalah riil terukur.
- Paragraf 3 (Dampak & Urgensi Penelitian): Jelaskan mengapa masalah ini mendesak untuk diteliti saat ini dan apa konsekuensi serius jika tidak ditangani.
- Paragraf 4 (Tinjauan Penelitian Terdahulu & Research Gap): Kaji 3-4 artikel jurnal sejenis terdahulu (sebutkan nama penulis, tahun, dan temuan intinya) lalu TEGASKAN research gap (kesenjangan riset/kebaruan yang belum diselesaikan peneliti terdahulu).
- Paragraf 5 (Penegasan Solusi & Fokus Penelitian): Tegaskan pendekatan atau metode yang diusulkan oleh penelitian ini, lokus/objek riset, dan kontribusi ilmiah yang ditawarkan.
Panjang naskah proporsional berkisar antara 900 sampai 1.500 kata (setara 2,5 - 4 halaman A4).`;

  const ruleLatarBelakang = await prisma.rule.upsert({
    where: { slug: "latar-belakang-skripsi" },
    update: {
      name: "Baku Mutu Latar Belakang Skripsi (Piramida Terbalik 5 Tahap)",
      description: "Standar penyusunan Bab 1.1 alur konsep -> fenomena empiris -> urgensi -> telaah jurnal & gap -> penegasan fokus solusi.",
      category: "STRUCTURAL",
      systemPrompt: latarBelakangPrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "latar-belakang-skripsi",
      name: "Baku Mutu Latar Belakang Skripsi (Piramida Terbalik 5 Tahap)",
      description: "Standar penyusunan Bab 1.1 alur konsep -> fenomena empiris -> urgensi -> telaah jurnal & gap -> penegasan fokus solusi.",
      category: "STRUCTURAL",
      systemPrompt: latarBelakangPrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log("✓ Rule Latar Belakang Skripsi diperbarui:", ruleLatarBelakang.slug);

  // 3. Rule: ieee-scopus-grounding (Rujukan Jurnal Bereputasi Tanpa Halusinasi)
  const ieeeGroundingPrompt = `ATURAN WAJIB RUJUKAN ILMIAH BEREPUTASI (IEEE / SCOPUS / SINTA):
1. WAJIB BERSUMBER DARI JURNAL TERVERIFIKASI POOL RISET: Seluruh klaim teoretis, data angka, perbandingan metode, dan telaah pustaka WAJIB diambil dari korpus jurnal bereputasi (IEEE Xplore, Scopus Q1-Q4, SINTA 1-2, DOAJ, ScienceDirect) yang telah disetujui di pool proyek.
2. DILARANG KERAS MENGARANG SITASI & DOI: Dilarang keras menciptakan nama penulis fiktif, judul artikel karangan, angka statistik palsu, ataupun tautan DOI rekaan. Setiap rujukan harus valid dan dapat diverifikasi secara akademis oleh pembimbing.
3. KONSISTENSI PENOMORAN SITASI: Rujukan sitasi kurung siku [1], [2], dst. harus merujuk PERSIS pada nomor urut jurnal di daftar rujukan proyek. Dilarang menukar atau mengubah nomor rujukan.
4. PARAFRASE PENUH (BEBAS PLAGIASI): Sajikan intisari dan temuan penelitian terdahulu dengan kalimat sendiri tanpa mengutip verbatim/menyalin kata demi kata dari artikel asli.`;

  const ruleIeeeGrounding = await prisma.rule.upsert({
    where: { slug: "ieee-scopus-grounding" },
    update: {
      name: "Rujukan Jurnal Bereputasi (IEEE / Scopus / SINTA)",
      description: "Menjamin setiap klaim, teori, dan telaah pustaka berlandaskan jurnal primer bereputasi dengan DOI terverifikasi tanpa halusinasi sitasi.",
      category: "CITATION",
      systemPrompt: ieeeGroundingPrompt,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug: "ieee-scopus-grounding",
      name: "Rujukan Jurnal Bereputasi (IEEE / Scopus / SINTA)",
      description: "Menjamin setiap klaim, teori, dan telaah pustaka berlandaskan jurnal primer bereputasi dengan DOI terverifikasi tanpa halusinasi sitasi.",
      category: "CITATION",
      systemPrompt: ieeeGroundingPrompt,
      isActive: true,
      isSystem: true,
    },
  });
  console.log("✓ Rule IEEE / Scopus Grounding diperbarui:", ruleIeeeGrounding.slug);

  // 4. Update Mapping ke Sub-Bab Utama
  const subBab11 = await prisma.subBab.findFirst({ where: { tag: "latar-belakang" } });
  if (subBab11) {
    // Bersihkan mapping lama subbab latar-belakang
    await prisma.subBabRuleMapping.deleteMany({ where: { subBabId: subBab11.id } });

    // Pasang aturan baru berurutan
    const rulesToMap = [
      ruleLatarBelakang.id,
      ruleIeeeGrounding.id,
      ruleAntiSlop.id,
    ];

    for (let i = 0; i < rulesToMap.length; i++) {
      await prisma.subBabRuleMapping.create({
        data: {
          subBabId: subBab11.id,
          ruleId: rulesToMap[i],
          order: i + 1,
          isRequired: true,
        },
      });
    }
    console.log("✓ Sub-Bab Latar Belakang berhasil dipetakan ke Latar Belakang, IEEE Grounding, & Anti-Slop.");
  }

  // Petakan IEEE Grounding dan Anti-Slop ke Bab 2 Sub-babs (landasan-teori, penelitian-terdahulu, kerangka-berpikir)
  const bab2Tags = ["landasan-teori", "penelitian-terdahulu", "kerangka-berpikir"];
  for (const tag of bab2Tags) {
    const sb = await prisma.subBab.findFirst({ where: { tag } });
    if (sb) {
      // Pastikan ieee-scopus-grounding dan anti-slop terdaftar
      const existingMappings = await prisma.subBabRuleMapping.findMany({ where: { subBabId: sb.id } });
      const ruleIds = existingMappings.map((m) => m.ruleId);

      if (!ruleIds.includes(ruleIeeeGrounding.id)) {
        await prisma.subBabRuleMapping.create({
          data: {
            subBabId: sb.id,
            ruleId: ruleIeeeGrounding.id,
            order: existingMappings.length + 1,
            isRequired: true,
          },
        });
      }
      if (!ruleIds.includes(ruleAntiSlop.id)) {
        await prisma.subBabRuleMapping.create({
          data: {
            subBabId: sb.id,
            ruleId: ruleAntiSlop.id,
            order: existingMappings.length + 2,
            isRequired: true,
          },
        });
      }
      console.log(`✓ Sub-Bab ${tag} berhasil dipetakan ke IEEE Grounding & Anti-Slop.`);
    }
  }

  // Pastikan SEMUA sub-bab memiliki rule wiriting-ai-slop
  const allSubBabs = await prisma.subBab.findMany();
  for (const sb of allSubBabs) {
    const exists = await prisma.subBabRuleMapping.findFirst({
      where: { subBabId: sb.id, ruleId: ruleAntiSlop.id },
    });
    if (!exists) {
      const count = await prisma.subBabRuleMapping.count({ where: { subBabId: sb.id } });
      await prisma.subBabRuleMapping.create({
        data: {
          subBabId: sb.id,
          ruleId: ruleAntiSlop.id,
          order: count + 1,
          isRequired: true,
        },
      });
    }
  }
  console.log("✓ Seluruh Sub-Bab telah diproteksi dengan Anti-AI Slop Writing Engine.");

  console.log("🎉 Sukses meng-upgrade sistem skills Zetera!");
}

main()
  .catch((e) => {
    console.error("Error executing upgrade:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
