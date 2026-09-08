import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import * as outlineService from "../services/outline.service.js";

async function test() {
  try {
    const project = await prisma.researchProject.findFirst({
      where: { id: "cmtsd44bn0026d38wj2zn5gjv" }
    });
    console.log("ResearchProject found:", project ? project.id : "none");
    if (project) {
      console.log("Title:", project.title);
      console.log("UserId:", project.userId);
      console.log("Running generateResearchBlueprint on project...");
      const res = await outlineService.generateResearchBlueprint({
        projectId: project.id,
        userId: project.userId
      });
      console.log("Success! Blueprint items count:", res.length);
      console.log("First item sample:", JSON.stringify(res[0], null, 2));
    }
  } catch (err) {
    console.error("Error in test:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
