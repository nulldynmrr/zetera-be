import "dotenv/config";
import app from "./app.js";
import prisma from "./lib/prisma.js";

const PORT = process.env.PORT || 5000;

async function main() {
  // Test DB connection sebelum listen
  await prisma.$connect();
  console.log("✓ Database connected");

  app.listen(PORT, () => {
    console.log(`✓ Server running → http://localhost:${PORT}`);
    console.log(`  Health check  → http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error("✗ Failed to start:", err.message);
  process.exit(1);
});
