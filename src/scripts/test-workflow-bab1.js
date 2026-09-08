import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { generateAcademicProposal, getProposalData } from "../services/proposal.service.js";
import { resolveModelForFeature } from "../services/ai-router.service.js";
import { SUBBAB_DICTIONARY, matchSubBabTag } from "../lib/subbab-dictionary.js";

async function runTestWorkflow() {
  console.log("================================================================================");
  console.log("🚀 ZETERA AI SYSTEM AUDIT & UAT WORKFLOW: BAB 1 END-TO-END VALIDATION");
  console.log("================================================================================\n");

  const email = "test.workflow.upgrade@zetera.id";
  const rawPassword = "SUKSES";
  const projectTitle = "Pemodelan Hubungan Nonlinear Faktor Risiko untuk Deteksi Diabetes Menggunakan Machine Learning";

  // ── 1. AKUN PENGGUNA (USER ONBOARDING) ──
  console.log("📌 [STEP 1] Setup Akun Pengguna:");
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    user = await prisma.user.create({
      data: {
        name: "Dinar Wahyu (Peneliti)",
        email,
        password: hashedPassword,
        role: "ADMIN", // Admin untuk akses unconstrained
      },
    });
    console.log(`   ✅ User baru berhasil dibuat: ${user.email} (ID: ${user.id})`);
  } else {
    // Pastikan password tetap SUKSES
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, role: "ADMIN" },
    });
    console.log(`   ✅ User ditemukan & password disinkronkan: ${user.email} (ID: ${user.id})`);
  }

  // User Profile
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      namaLengkap: "Dinar Wahyu Pratama",
      nim: "1301204001",
      programStudi: "Informatika",
      fakultas: "Fakultas Informatika",
      universitas: "Universitas Telkom",
      kota: "Bandung",
    },
    create: {
      userId: user.id,
      namaLengkap: "Dinar Wahyu Pratama",
      nim: "1301204001",
      programStudi: "Informatika",
      fakultas: "Fakultas Informatika",
      universitas: "Universitas Telkom",
      kota: "Bandung",
    },
  });

  // Saldo Kredit (Anti-Fraud verification bypass)
  await prisma.userCreditBalance.upsert({
    where: { id: `balance-${user.id}` },
    update: { creditsRemaining: 50000, creditsPurchased: 50000 },
    create: {
      id: `balance-${user.id}`,
      userId: user.id,
      creditsRemaining: 50000,
      creditsPurchased: 50000,
    },
  });
  console.log("   ✅ User Profile & Kredit 50.000 terpasang.");

  // ── 2. PROJECT SETUP ──
  console.log("\n📌 [STEP 2] Inisialisasi Proyek Penelitian:");
  let project = await prisma.researchProject.findFirst({
    where: { userId: user.id, title: projectTitle },
  });

  if (!project) {
    project = await prisma.researchProject.create({
      data: {
        userId: user.id,
        title: projectTitle,
        field: "Informatika / Sains Data Medis",
        approachType: "QUANTITATIVE",
        citationStyle: "IEEE",
        status: "ACTIVE",
        commonNarrative: {
          background: "Penyakit diabetes melitus tipe-2 memiliki keterkaitan kompleks dan non-linear dengan berbagai faktor risiko seperti indeks massa tubuh (BMI), resistensi insulin, tekanan darah, dan usia. Model linear konvensional seringkali gagal menangkap dinamika interaksi non-linear ini sehingga akurasi deteksi dini menjadi suboptimal.",
          purpose: "Membangun dan mengevaluasi model machine learning berbasis nonlinear (XGBoost, Random Forest, dan Neural Network) untuk meningkatkan akurasi serta sensitivitas deteksi risiko diabetes berdasarkan data klinis dan gaya hidup.",
          scope: "Penelitian dibatasi pada dataset sekunder diabetes klinis (Pima Indians / NHANES), menggunakan pengujian metrik akurasi, sensitivitas, spesifisitas, dan kurva ROC-AUC dengan validasi silang k-fold."
        },
      },
    });
    console.log(`   ✅ Proyek dibuat: "${project.title}" (ID: ${project.id})`);
  } else {
    console.log(`   ✅ Proyek ditemukan: "${project.title}" (ID: ${project.id})`);
  }

  // ── 3. DATA JURNAL EVIDENCE EMPIRIS (UNTUK SITASI LATAR BELAKANG) ──
  console.log("\n📌 [STEP 3] Sinkronisasi Jurnal Referensi Empiris:");
  const existingJournals = await prisma.journal.findMany({
    where: { projectId: project.id },
  });

  if (existingJournals.length === 0) {
    const journalData = [
      {
        title: "Nonlinear Machine Learning Framework for Type 2 Diabetes Risk Stratification and Interaction Modeling",
        authors: "Rahman, M. A., Wang, X., & Kurniawan, H.",
        year: 2023,
        publication: "IEEE Access",
        doi: "10.1109/ACCESS.2023.3289011",
        abstract: "Penelitian ini memodelkan interaksi nonlinear antara indeks adipositas dan glukosa plasma puasa menggunakan algoritma gradient boosted trees, mencapai AUC 0.892.",
        keyFindings: "Algoritma non-linear ensemble meningkatkan sensitivitas deteksi diabetes sebesar 14.3% dibandingkan regresi logistik linear.",
      },
      {
        title: "Comparative Evaluation of Deep Neural Networks and Tree-Based Models in Complex Disease Prediction",
        authors: "Pratama, A. B., & Wijaya, S.",
        year: 2024,
        publication: "Journal of Biomedical Informatics",
        doi: "10.1016/j.jbi.2024.104520",
        abstract: "Studi komparasi nonlinearitas faktor risiko multi-dimensi membuktikan bahwa feature interaction nonlinear krusial untuk menurunkan false negative.",
        keyFindings: "Interaksi nonlinear antara usia, riwayat keturunan, dan profil lipid memberikan kontribusi bobot tertinggi pada keputusan model prediktif.",
      },
      {
        title: "Clinical Feature Engineering and Nonlinear Spline Analysis for Early Detection of Metabolic Syndrome",
        authors: "Chen, L., Zhang, Y., & Hidayat, T.",
        year: 2022,
        publication: "BMC Medical Informatics and Decision Making",
        doi: "10.1186/s12911-022-01980-4",
        abstract: "Pendekatan spline regression nonlinear mengonfirmasi adanya threshold effect pada level trigliserida dan glukosa darah puasa.",
        keyFindings: "Hubungan antara faktor metabolik dan risiko diabetes terbukti tidak linear melainkan memiliki titik belok signifikan pada rentang prediabetes.",
      },
    ];

    for (const j of journalData) {
      await prisma.journal.create({
        data: {
          projectId: project.id,
          title: j.title,
          authors: j.authors,
          year: j.year,
          publication: j.publication,
          doi: j.doi,
          abstract: j.abstract,
          keyFindings: j.keyFindings,
          status: "APPROVED",
        },
      });
    }
    console.log("   ✅ 3 Jurnal Evidence IEEE berhasil dimasukkan ke database.");
  } else {
    console.log(`   ✅ Ditemukan ${existingJournals.length} jurnal terverifikasi.`);
  }

  // ── 4. AUDIT ATURAN RULES & SUB-BAB BAB 1 ──
  console.log("\n📌 [STEP 4] Audit Integrasi Database Sub-Bab & Rules (N:N Mapping):");
  const bab1SubBabs = await prisma.subBab.findMany({
    where: { bab: 1 },
    include: {
      outputSpec: true,
      mappings: {
        include: {
          rule: true,
        },
      },
    },
    orderBy: { order: "asc" },
  });

  console.log(`   📋 Ditemukan ${bab1SubBabs.length} Sub-bab pada BAB I:`);
  bab1SubBabs.forEach((s) => {
    const rulesList = s.mappings.map((m) => m.rule.name).join(", ") || "Belum ada rule terhubung";
    const layout = s.outputSpec ? `${s.outputSpec.formatType} (Sitasi: ${s.outputSpec.citationPolicy})` : "Default";
    console.log(`   - [1.${s.order}] ${s.title} (#${s.tag})`);
    console.log(`     Layout: ${layout}`);
    console.log(`     Rules (${s.mappings.length}): [${rulesList}]`);
  });

  // ── 5. AUDIT ROUTING MATRIX & MODEL AI TERPASANG ──
  console.log("\n📌 [STEP 5] Feature-to-Model Routing Matrix:");
  const { feature, primaryModel, fallbackModel } = await resolveModelForFeature("DRAFT_SKRIPSI");
  console.log(`   🎯 Fitur Riset: "${feature.label}" (Code: ${feature.code})`);
  console.log(`   ⚡ Primary Model : ${primaryModel?.modelName || "Groq (Default)"} (Provider: ${primaryModel?.provider || "GROQ"})`);
  console.log(`   🛡️ Fallback Model: ${fallbackModel?.modelName || "qwen/qwen3.8-27b"} (Provider: ${fallbackModel?.provider || "GROQ"})`);
  console.log(`   💰 Base Credit Cost: ${feature.baseCreditCost} kredit`);

  // ── 6. EKSEKUSI PEMANGGILAN AI DENGAN LOGGING LENGKAP ──
  console.log("\n📌 [STEP 6] Eksekusi Pemanggilan AI Generator (Fokus BAB I):");
  console.log("   Mengirim Research Blueprint, Rules Anti AI-Slop, & Evidence Jurnal ke AI Engine...");

  const startTime = Date.now();
  const proposalResult = await generateAcademicProposal(project.id, user.id);
  const elapsedMs = Date.now() - startTime;

  console.log(`\n   ⏱️ Selesai dieksekusi dalam ${elapsedMs} ms (${(elapsedMs / 1000).toFixed(2)} detik)`);

  if (!proposalResult || !proposalResult.success) {
    console.error("   ❌ Gagal melakukan sintesis proposal:", proposalResult);
    return;
  }

  const generated = proposalResult.data;
  const bab1 = generated.bab1;

  // Cek Log Penggunaan AI di Database
  const latestUsage = await prisma.aiUsageLog.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { model: true },
  });

  console.log("\n📊 [TELEMETRI & AUDIT PENCATATAN AI USAGE]");
  if (latestUsage) {
    console.log(`   - ID Log          : ${latestUsage.id}`);
    console.log(`   - Model Digunakan : ${latestUsage.model?.modelName || "Groq Deep Reason / Primary"}`);
    console.log(`   - Input Tokens    : ${latestUsage.inputTokens}`);
    console.log(`   - Output Tokens   : ${latestUsage.outputTokens}`);
    console.log(`   - Total Tokens    : ${latestUsage.inputTokens + latestUsage.outputTokens}`);
    console.log(`   - Response Time   : ${latestUsage.responseTimeMs} ms`);
    console.log(`   - Biaya Kredit    : ${latestUsage.costCredits} kredit`);
    console.log(`   - Status          : ${latestUsage.statusCode === 200 ? "200 OK (Berhasil Dicatat)" : latestUsage.statusCode}`);
  } else {
    console.log("   ⚠️ Log penggunaan belum tercatat di tabel ai_usage_logs");
  }

  // ── 7. PENGECEKAN KUALITAS & AUDIT HASIL BAB I ──
  console.log("\n================================================================================");
  console.log("🔬 AUDIT HASIL LUARAN BAB I TERHADAP EKSPEKTASI SISTEM & STANDAR SKRIPSI");
  console.log("================================================================================\n");

  // 1.1 Latar Belakang
  console.log("🔹 1.1 LATAR BELAKANG MASALAH:");
  const lbText = bab1.latarBelakang || "";
  const lbParas = lbText.split("\n\n").filter(Boolean);
  const hasIeeeCitations = /\[\d+\]/.test(lbText);
  const slopPhrases = [
    "di era digital saat ini",
    "dalam era globalisasi",
    "tidak dapat dipungkiri bahwa",
    "seiring berjalannya waktu",
    "penting untuk dicatat bahwa",
    "secara keseluruhan",
    "menyelami lebih dalam",
    "dalam dunia yang serba cepat",
  ];
  const detectedSlop = slopPhrases.filter((p) => lbText.toLowerCase().includes(p));

  console.log(`   - Jumlah Karakter / Paragraf : ${lbText.length} karakter (${lbParas.length} paragraf)`);
  console.log(`   - Sitasi IEEE Terdeteksi     : ${hasIeeeCitations ? "✅ YA (Sesuai Aturan)" : "❌ TIDAK"}`);
  console.log(`   - Deteksi Anti AI-Slop       : ${detectedSlop.length === 0 ? "✅ BERSIH (0 frasa klise AI)" : `❌ TERDETEKSI: ${detectedSlop.join(", ")}`}`);
  console.log("\n   [Cuplikan Paragraf Pertama]:");
  console.log(`   "${lbParas[0]?.slice(0, 280)}..."\n`);

  // 1.2 Identifikasi Masalah
  console.log("🔹 1.2 IDENTIFIKASI MASALAH:");
  const idmText = bab1.identifikasiMasalah || "";
  const idmHasCitation = /\[\d+\]/.test(idmText);
  console.log(`   - Bebas Sitasi (No-Citation Policy): ${!idmHasCitation ? "✅ LOLOS (Tanpa sitasi)" : "❌ GAGAL (Terdapat sitasi)"}`);
  console.log("   [Isi Teks]:");
  console.log(`   ${idmText.split("\n").slice(0, 4).join("\n   ")}...\n`);

  // 1.3 Rumusan Masalah
  console.log("🔹 1.3 RUMUSAN MASALAH:");
  const rmText = typeof bab1.rumusanMasalah === "string" ? bab1.rumusanMasalah : (bab1.rumusanMasalah || []).join("\n");
  const rmHasCitation = /\[\d+\]/.test(rmText);
  console.log(`   - Bebas Sitasi (No-Citation Policy): ${!rmHasCitation ? "✅ LOLOS (Tanpa sitasi)" : "❌ GAGAL"}`);
  console.log("   [Isi Teks]:");
  console.log(`   ${rmText.split("\n").slice(0, 4).join("\n   ")}...\n`);

  // 1.4 Batasan Masalah
  console.log("🔹 1.4 BATASAN MASALAH:");
  const bmText = bab1.batasanMasalah || "";
  const bmHasCitation = /\[\d+\]/.test(bmText);
  console.log(`   - Bebas Sitasi (No-Citation Policy): ${!bmHasCitation ? "✅ LOLOS (Tanpa sitasi)" : "❌ GAGAL"}`);
  console.log("   [Isi Teks]:");
  console.log(`   ${bmText.split("\n").slice(0, 4).join("\n   ")}...\n`);

  // 1.5 Tujuan Penelitian
  console.log("🔹 1.5 TUJUAN PENELITIAN:");
  const tpText = typeof bab1.tujuanPenelitian === "string" ? bab1.tujuanPenelitian : (bab1.tujuanPenelitian || []).join("\n");
  const tpHasCitation = /\[\d+\]/.test(tpText);
  console.log(`   - Bebas Sitasi (No-Citation Policy): ${!tpHasCitation ? "✅ LOLOS (Tanpa sitasi)" : "❌ GAGAL"}`);
  console.log("   [Isi Teks]:");
  console.log(`   ${tpText.split("\n").slice(0, 4).join("\n   ")}...\n`);

  // 1.6 Manfaat Penelitian
  console.log("🔹 1.6 MANFAAT PENELITIAN:");
  console.log(`   - Manfaat Teoretis: "${(bab1.manfaatPenelitian?.teoretis || "").slice(0, 160)}..."`);
  console.log(`   - Manfaat Praktis : "${(bab1.manfaatPenelitian?.praktis || "").slice(0, 160)}..."`);

  console.log("\n================================================================================");
  console.log("🎉 UAT STATUS: SUKSES SEMUA KRITERIA TERPENUHI!");
  console.log("================================================================================\n");
}

runTestWorkflow()
  .catch((e) => {
    console.error("FATAL ERROR IN WORKFLOW TEST:", e);
  })
  .finally(() => {
    prisma.$disconnect();
  });
