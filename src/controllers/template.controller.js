import { z } from "zod";
import * as templateService from "../services/template.service.js";

const cloneSchema = z.object({
  name: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  sections: z
    .array(
      z.object({
        order: z.number().int().optional(),
        title: z.string().min(1),
        isOptional: z.boolean().optional(),
        guidanceText: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function listTemplates(req, res, next) {
  try {
    const templates = await templateService.listTemplates(req.user.sub);
    res.status(200).json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const template = await templateService.getTemplate(req.params.templateId, req.user.sub);
    res.status(200).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function cloneTemplate(req, res, next) {
  try {
    const { name } = cloneSchema.parse(req.body);
    const template = await templateService.cloneTemplate(req.params.templateId, req.user.sub, name);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const validData = updateTemplateSchema.parse(req.body);
    const template = await templateService.updateTemplate(req.params.templateId, req.user.sub, validData);
    res.status(200).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    await templateService.deleteTemplate(req.params.templateId, req.user.sub);
    res.status(200).json({ success: true, message: "Template berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function seedDefaultTemplates(req, res, next) {
  try {
    const result = await templateService.seedDefaultTemplate();
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
