import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resolveSubchapterTag } from "../src/services/taxonomy.service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting backfill of subchapter semantic tags in ResearchOutlineItem...");

  const allItems = await prisma.researchOutlineItem.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${allItems.length} total outline items in database.`);

  let matchedCount = 0;
  let customCount = 0;

  for (const item of allItems) {
    const { tag, isCustom, needsReview } = resolveSubchapterTag(item.title, item.itemId);

    await prisma.researchOutlineItem.update({
      where: { id: item.id },
      data: {
        tag,
        isCustom,
        needsReview,
      },
    });

    if (tag) {
      matchedCount++;
      console.log(`  ✓ Item [${item.itemId}] "${item.title}" => tag: "${tag}"`);
    } else {
      customCount++;
      console.log(`  ⚠️ Item [${item.itemId}] "${item.title}" => CUSTOM (needsReview: true)`);
    }
  }

  console.log(`\n✅ Backfill completed! Matched: ${matchedCount}, Custom/Review: ${customCount}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
