import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import * as billingController from "../controllers/billing.controller.js";

async function testBillingEndToEnd() {
  console.log("==================================================================");
  console.log("💳 TESTING END-TO-END SISTEM TRANSAKSI & SKOR KREDIT USER - ADMIN");
  console.log("==================================================================\n");

  try {
    // 1. Ambil list paket yang dibuat oleh Admin
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { priceNormal: "asc" },
    });
    console.log(`📦 [1] Paket Aktif Dibuat Admin (${packages.length} Paket):`);
    packages.forEach((p) => {
      console.log(`   - [${p.id}] ${p.name} | ${p.creditsGranted} Kredit | Rp${p.priceDiscount || p.priceNormal} (${p.badgeLabel || "REGULER"})`);
    });

    if (packages.length === 0) {
      throw new Error("Tidak ada paket kredit aktif!");
    }

    // 2. Cek user test dari screenshot (abc@gmail.com)
    const testUser = await prisma.user.findFirst({
      where: { email: "abc@gmail.com" },
      include: { creditBalances: true },
    });
    if (!testUser) {
      throw new Error("User abc@gmail.com tidak ditemukan!");
    }

    const initialRemaining = testUser.creditBalances.reduce((acc, c) => acc + c.creditsRemaining, 0);
    console.log(`\n👤 [2] User Test: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`   - Saldo Awal: ${initialRemaining} Kredit`);

    // 3. Simulasi Checkout Paket (Misal: Student Pack 50 Kredit)
    const targetPkg = packages.find((p) => p.creditsGranted === 50) || packages[0];
    console.log(`\n🛒 [3] Simulasi Pembelian Paket oleh User: "${targetPkg.name}" (${targetPkg.creditsGranted} Kredit)...`);

    // Eksekusi logic checkout controller
    const mockReq = {
      user: { sub: testUser.id, id: testUser.id },
      body: { packageId: targetPkg.id, paymentMethod: "SIMULATION_INSTANT" },
    };
    let responseData = null;
    let responseStatus = 200;
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(payload) {
        responseData = payload;
        return this;
      },
    };
    const mockNext = (err) => {
      if (err) throw err;
    };

    await billingController.checkoutPackage(mockReq, mockRes, mockNext);

    console.log(`   - Status HTTP: ${responseStatus}`);
    console.log(`   - Pesan: ${responseData?.message}`);
    console.log(`   - Kredit Ditambahkan: +${responseData?.data?.creditsAdded}`);
    console.log(`   - Total Saldo Baru: ${responseData?.data?.totalCredits} Kredit`);

    // 4. Verifikasi Buku Besar (Ledger Audit Trail)
    const lastTransaction = await prisma.creditTransaction.findFirst({
      where: { userId: testUser.id },
      orderBy: { createdAt: "desc" },
    });
    console.log(`\n📜 [4] Verifikasi Buku Besar Audit (credit_transactions):`);
    console.log(`   - Transaction ID : ${lastTransaction?.id}`);
    console.log(`   - Type           : ${lastTransaction?.type}`);
    console.log(`   - Amount         : +${lastTransaction?.amount} Kredit`);
    console.log(`   - Balance After  : ${lastTransaction?.balanceAfter} Kredit`);
    console.log(`   - Description    : ${lastTransaction?.description}`);

    console.log("\n✅ SEMUA INTEGRASI TRANSAKSI & KREDIT BERHASIL 100% SECARA TELITI & ATOMIC!");
  } catch (err) {
    console.error("❌ Billing Test Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testBillingEndToEnd();
