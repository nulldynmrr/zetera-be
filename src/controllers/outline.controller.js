import * as outlineService from "../services/outline.service.js";

export async function generateBlueprint(req, res) {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id || req.user?.sub;
    const result = await outlineService.generateResearchBlueprint({ projectId, userId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getOutline(req, res) {
  try {
    const { id: projectId } = req.params;
    const userId = req.user?.id || req.user?.sub;
    const result = await outlineService.getOutline(projectId, userId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function updateOutlineItem(req, res) {
  try {
    const { id: projectId, itemId } = req.params;
    const userId = req.user?.id || req.user?.sub;
    const { status, userNotes } = req.body;
    const result = await outlineService.updateOutlineItem(projectId, userId, itemId, { status, userNotes });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function addEvidence(req, res) {
  try {
    const { id: projectId, itemId } = req.params;
    const userId = req.user?.id || req.user?.sub;
    const result = await outlineService.addEvidenceToItem(projectId, userId, itemId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function removeEvidence(req, res) {
  try {
    const { id: projectId, itemId, evidenceId } = req.params;
    const userId = req.user?.id || req.user?.sub;
    const result = await outlineService.removeEvidenceFromItem(projectId, userId, itemId, evidenceId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function searchPapers(req, res) {
  try {
    const { query } = req.query;
    const limit = parseInt(req.query.limit) || 8;
    if (!query?.trim()) return res.status(400).json({ success: false, error: "Query pencarian wajib diisi" });
    const results = await outlineService.searchPapersForItem(query, limit);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Overhaul v2: Single Sub-bab Blueprint Generator ──
export async function generateItemBlueprint(req, res) {
  try {
    const { id: projectId, itemId } = req.params;
    const userId = req.user.id || req.user.sub;
    const result = await outlineService.generateItemBlueprint({ projectId, userId, itemId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// ── Overhaul v2: Pool Journals for Specific Outline Item ──
export async function getPoolJournals(req, res) {
  try {
    const { id: projectId, itemId } = req.params;
    const userId = req.user.id || req.user.sub;
    const result = await outlineService.getPoolJournalsForItem(projectId, userId, itemId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// ── Smart Pool Matching to Instruction Point (§3) ─────────
export async function matchPoolPoint(req, res) {
  try {
    const { id: projectId } = req.params;
    const { pointText } = req.body;
    const userId = req.user?.id || req.user?.sub;
    const result = await outlineService.matchPoolToPoint(pointText, projectId, userId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// ── Overhaul v2: Synthesize All Outline Points with DOI Verified Journals ──
export async function synthesizeAllOutlinePoints(req, res) {
  try {
    const { id: projectId, itemId } = req.params;
    const userId = req.user.id || req.user.sub;
    const result = await outlineService.synthesizeAllOutlinePoints({ projectId, userId, itemId });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}



