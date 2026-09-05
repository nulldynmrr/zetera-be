import "dotenv/config";
import { verifyBalance, recordCreditTransaction } from "../services/billing.service.js";
import { encryptText, decryptText } from "../lib/encryption.js";
import prisma from "../lib/prisma.js";

async function main() {
  console.log("==================================================");
  console.log("🛡️  RUNNING ZETERA ANTI-FRAUD & INTEGRITY TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Zero credit check passes
  try {
    const r1 = await verifyBalance("user-test-free", 0);
    if (r1.success) {
      console.log("✅ TEST 1: Free-tier (0 credit) bypasses deduction correctly.");
      passed++;
    }
  } catch (err) {
    console.error("❌ TEST 1 FAILED:", err.message);
    failed++;
  }

  // Test 2: Insufficient credit throws HTTP 402
  try {
    await verifyBalance("user-with-zero-balance", 999999);
    console.error("❌ TEST 2 FAILED: Expected 402 was not thrown.");
    failed++;
  } catch (err) {
    if (err.statusCode === 402) {
      console.log("✅ TEST 2: Insufficient credit correctly rejected with HTTP 402 (Payment Required).");
      console.log("   Message:", err.message);
      passed++;
    } else {
      console.error("❌ TEST 2 FAILED with status:", err.statusCode);
      failed++;
    }
  }

  // Test 3: Unauthenticated user on paid feature throws HTTP 401
  try {
    await verifyBalance(null, 15);
    console.error("❌ TEST 3 FAILED: Expected 401 was not thrown.");
    failed++;
  } catch (err) {
    if (err.statusCode === 401) {
      console.log("✅ TEST 3: Unauthenticated request rejected with HTTP 401.");
      passed++;
    } else {
      console.error("❌ TEST 3 FAILED with status:", err.statusCode);
      failed++;
    }
  }

  // Test 4: AES-256-GCM authenticated encryption round-trip
  try {
    const rawSecret = "sk-live-test-encryption-key-anti-fraud";
    const { cipherText, iv } = encryptText(rawSecret);
    const decrypted = decryptText(cipherText, iv);
    if (decrypted === rawSecret && iv.includes(":")) {
      console.log("✅ TEST 4: AES-256-GCM authenticated encryption verified.");
      passed++;
    } else {
      throw new Error("Mismatch on decrypted secret");
    }
  } catch (err) {
    console.error("❌ TEST 4 FAILED:", err.message);
    failed++;
  }

  // Test 5: Credit transaction ledger recording
  try {
    const user = await prisma.user.findFirst();
    if (user) {
      const tx = await recordCreditTransaction({
        userId: user.id,
        type: "ADMIN_ADJUSTMENT",
        amount: 10,
        description: "Test Anti-Fraud Audit Ledger Entry",
        refId: "test-integrity-check",
      });
      if (tx && tx.id) {
        console.log(`✅ TEST 5: CreditTransaction audit ledger entry created (id: ${tx.id}).`);
        passed++;
        await prisma.creditTransaction.delete({ where: { id: tx.id } });
      }
    } else {
      console.log("⚠️ TEST 5 SKIPPED: No user found in database.");
    }
  } catch (err) {
    console.error("❌ TEST 5 FAILED:", err.message);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`🏁 HASIL VERIFIKASI: ${passed} BERHASIL, ${failed} GAGAL`);
  console.log("==================================================\n");

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
