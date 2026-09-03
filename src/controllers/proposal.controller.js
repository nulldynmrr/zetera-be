import * as proposalService from "../services/proposal.service.js";

/**
 * GET /api/projects/:projectId/proposal
 * Mengambil data struktur proposal (profil kampus + ringkasan node & jurnal)
 */
export async function getProposal(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub;
    const data = await proposalService.getProposalData(projectId, userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/projects/:projectId/proposal
 * POST /api/projects/:projectId/proposal/save
 * Menyimpan draf dan hasil editan naskah proposal ke database (MySQL)
 */
export async function saveProposal(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub;
    const saved = await proposalService.saveProposalData(projectId, userId, req.body || {});
    res.status(200).json({
      success: true,
      message: "Naskah proposal berhasil disimpan ke database.",
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/proposal/generate
 * Men-generate naskah proposal lengkap (Bab 1, 2, 3, Matriks, Sitasi) via AI / Engine
 */
export async function generateProposal(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub;
    const result = await proposalService.generateAcademicProposal(projectId, userId, req.body || {});
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/proposal/export-docx
 * Mendownload berkas Word (.DOCX) resmi format proposal skripsi Indonesia
 */
export async function exportDocx(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub;
    const buffer = await proposalService.exportProposalDocxFile(projectId, userId);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Proposal_Skripsi_${projectId.slice(-6)}.docx"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/proposal/export-latex
 * Mendownload berkas bundle LaTeX Overleaf (.ZIP) per sub-bab
 */
export async function exportLatex(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub;
    const templateType = req.query.template || "TELKOM_FIF";

    const zipBuffer = await proposalService.exportProposalLatexZipFile(projectId, userId, templateType);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="LaTeX_Proposal_${templateType}_${projectId.slice(-6)}.zip"`
    );
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/proposal/chat
 * Chat kontekstual AI Writer per section proposal
 */
export async function chatWithProposal(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.sub || req.user.id;
    const { sectionId, command, currentContent, conversationHistory } = req.body;

    if (!command?.trim()) {
      return res.status(400).json({ success: false, message: "Perintah/instruksi wajib diisi" });
    }

    const result = await proposalService.chatWithProposal(projectId, userId, {
      sectionId,
      command,
      currentContent,
      conversationHistory,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

