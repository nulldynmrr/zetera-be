import { prisma } from "../lib/prisma.js";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from "docx";

/**
 * Service to generate Research Gap Analysis Matrix.
 * Returns an array of objects representing rows in the matrix.
 */
export async function generateGapMatrix(projectId) {
  // Fetch project journals and framework nodes
  const project = await prisma.researchProject.findUnique({
    where: { id: projectId },
    include: { journals: true, frameworkNodes: true },
  });
  if (!project) throw new Error("Project not found");

  // Simple heuristic: match each node with the first approving journal that mentions it
  const matrix = project.frameworkNodes.map((node) => {
    const supportingJournal = project.journals.find((j) =>
      (j.keyFindings || "").toLowerCase().includes(node.label.toLowerCase()) && j.status === "APPROVED"
    );
    return {
      nodeLabel: node.label,
      nodeType: node.type,
      existingFinding: supportingJournal ? supportingJournal.keyFindings || "-" : "-",
      gap: supportingJournal ? "None" : "Research gap identified",
      suggestedStudy: supportingJournal ? "-" : `Investigate ${node.label} in context of ${project.title}`,
    };
  });
  return matrix;
}

/**
 * Service to generate an outline based on the project and gap matrix.
 */
export async function generateOutline(projectId) {
  const project = await prisma.researchProject.findUnique({
    where: { id: projectId },
    include: { frameworkNodes: true },
  });
  if (!project) throw new Error("Project not found");

  const sections = [];
  sections.push("# Pendahuluan");
  sections.push(`Judul: ${project.title}`);
  sections.push(`Bidang: ${project.field || "Umum"}`);
  sections.push("\n# Tinjauan Pustaka");
  project.frameworkNodes.forEach((n) => {
    sections.push(`- ${n.label} (${n.type})`);
  });
  sections.push("\n# Metodologi");
  sections.push("Deskripsikan metode penelitian yang akan digunakan.");
  sections.push("\n# Hasil yang Diharapkan");
  sections.push("Jelaskan kontribusi potensial penelitian.");

  return sections.join("\n\n");
}

/**
 * Export a proposal as a DOCX file combining gap matrix and outline.
 * Returns a Buffer containing the DOCX binary.
 */
export async function exportProposalDocx(projectId) {
  const matrix = await generateGapMatrix(projectId);
  const outline = await generateOutline(projectId);

  const tableRows = matrix.map((row) =>
    new TableRow({ children: [
      new TableCell({ children: [new Paragraph(row.nodeLabel)] }),
      new TableCell({ children: [new Paragraph(row.nodeType)] }),
      new TableCell({ children: [new Paragraph(row.existingFinding)] }),
      new TableCell({ children: [new Paragraph(row.gap)] }),
      new TableCell({ children: [new Paragraph(row.suggestedStudy)] }),
    ] })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "Research Gap Analysis Matrix", heading: "HEADING_1" }),
        new Table({ rows: [
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph("Node")] }),
            new TableCell({ children: [new Paragraph("Type")] }),
            new TableCell({ children: [new Paragraph("Existing Finding")] }),
            new TableCell({ children: [new Paragraph("Gap")] }),
            new TableCell({ children: [new Paragraph("Suggested Study")] }),
          ]}),
          ...tableRows,
        ]}),
        new Paragraph({ text: "\nOutline", heading: "HEADING_1" }),
        new Paragraph({ children: [new TextRun({ text: outline, break: 1 })] }),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
