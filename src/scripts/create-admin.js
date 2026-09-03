import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

async function createOrPromoteAdmin() {
  const email = process.argv[2] || "admin@zetera.id";
  const password = process.argv[3] || "Admin123!";
  const name = "Super Administrator";

  console.log(`\nMembuat atau mempromosikan akun admin: ${email}...`);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });
    console.log(`✓ Akun "${existing.email}" berhasil dipromosikan menjadi ADMIN!`);
  } else {
    const hashed = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "ADMIN",
      },
    });
    console.log(`✓ Akun Admin baru berhasil dibuat:`);
    console.log(`  Email    : ${created.email}`);
    console.log(`  Password : ${password}`);
    console.log(`  Role     : ${created.role}`);
  }

  process.exit(0);
}

createOrPromoteAdmin().catch((err) => {
  console.error("✗ Gagal:", err);
  process.exit(1);
});
