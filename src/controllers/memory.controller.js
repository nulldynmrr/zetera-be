import * as memoryService from "../services/memory.service.js";

export async function getMemory(req, res, next) {
  try {
    const { projectId } = req.params;
    const memory = await memoryService.getProjectMemory(projectId);
    res.status(200).json({ success: true, data: memory });
  } catch (err) {
    next(err);
  }
}

export async function updateToc(req, res, next) {
  try {
    const { projectId } = req.params;
    const { tocItems } = req.body;
    const memory = await memoryService.updateTocSnapshot(projectId, tocItems || []);
    res.status(200).json({ success: true, data: memory });
  } catch (err) {
    next(err);
  }
}

export async function updateCitation(req, res, next) {
  try {
    const { projectId } = req.params;
    const { sectionId, citations } = req.body;
    const memory = await memoryService.updateCitationMap(projectId, sectionId, citations || []);
    res.status(200).json({ success: true, data: memory });
  } catch (err) {
    next(err);
  }
}
