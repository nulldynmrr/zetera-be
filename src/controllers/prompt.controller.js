import * as promptService from "../services/prompt.service.js";

export async function listPrompts(req, res, next) {
  try {
    const { category, tag, search, activeOnly } = req.query;
    const prompts = await promptService.listSkillPrompts({
      category,
      tag,
      search,
      activeOnly: activeOnly === "true",
    });
    res.json({ success: true, data: prompts });
  } catch (err) {
    next(err);
  }
}

export async function getPrompt(req, res, next) {
  try {
    const { code } = req.params;
    const prompt = await promptService.getSkillPrompt(code);
    if (!prompt) return res.status(404).json({ success: false, message: "Prompt tidak ditemukan" });
    res.json({ success: true, data: prompt });
  } catch (err) {
    next(err);
  }
}

export async function createPrompt(req, res, next) {
  try {
    const prompt = await promptService.createSkillPrompt(req.body);
    res.status(201).json({ success: true, data: prompt });
  } catch (err) {
    next(err);
  }
}

export async function updatePrompt(req, res, next) {
  try {
    const { id } = req.params;
    const prompt = await promptService.updateSkillPrompt(id, req.body);
    res.json({ success: true, data: prompt });
  } catch (err) {
    next(err);
  }
}

export async function deletePrompt(req, res, next) {
  try {
    const { id } = req.params;
    const result = await promptService.deleteSkillPrompt(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
