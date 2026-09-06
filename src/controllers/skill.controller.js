import * as skillService from "../services/skill.service.js";

export async function runSkill(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const { projectId, tag, skill, targetText, citationStyle } = req.body;

    if (!projectId || !skill) {
      return res.status(400).json({
        success: false,
        error: "Parameter projectId dan skill wajib diisi",
      });
    }

    const result = await skillService.runSkill({
      userId,
      projectId,
      tag: tag || "latar_belakang",
      skill,
      targetText,
      citationStyle,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function parseIntent(req, res, next) {
  try {
    const { text, projectId } = req.body;
    const result = await skillService.routeIntent(text, projectId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getDraft(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const { projectId, tag } = req.params;
    const draft = await skillService.resolveDraft(userId, projectId, tag);
    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
}

export async function saveDraft(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const { projectId, tag } = req.params;
    const { content, itemId } = req.body;

    const saved = await skillService.saveDraft(userId, projectId, tag, content, itemId);
    res.json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
}
