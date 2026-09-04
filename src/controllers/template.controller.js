import { z } from "zod";
import * as templateService from "../services/template.service.js";

const cloneSchema = z.object({
  name: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  formatType: z.enum(["LATEX", "DOCX"]).optional(),
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
  variables: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().optional(),
        varType: z.enum(["TEXT", "IMAGE"]).optional(),
        required: z.boolean().optional(),
        defaultValue: z.string().optional().nullable(),
        defaultAssetId: z.string().optional().nullable(),
        bindingKey: z.string().optional(),
        order: z.number().int().optional(),
      })
    )
    .optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  formatType: z.enum(["LATEX", "DOCX"]).optional().default("LATEX"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().default("PUBLISHED"),
  version: z.union([z.string(), z.number()]).optional().default(1),
  sourceFaculty: z.string().optional().nullable(),
  sourceCampus: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  university: z.string().optional().nullable(),
  faculty: z.string().optional().nullable(),
  preamble: z.string().optional().nullable(),
  marginConfig: z.any().optional().nullable(),
  rawLatex: z.string().optional().nullable(),
  latexSource: z.string().optional().nullable(),
  packageDetails: z.any().optional().nullable(),
  numberingConfig: z.any().optional().nullable(),
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
  variables: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().optional(),
        varType: z.enum(["TEXT", "IMAGE"]).optional(),
        required: z.boolean().optional(),
        defaultValue: z.string().optional().nullable(),
        defaultAssetId: z.string().optional().nullable(),
        bindingKey: z.string().optional(),
        order: z.number().int().optional(),
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

export async function createTemplate(req, res, next) {
  try {
    const validData = createTemplateSchema.parse(req.body);
    const isAdmin = req.user?.role === "ADMIN";
    const template = await templateService.createTemplate(req.user.sub, validData, isAdmin);
    res.status(201).json({ success: true, data: template });
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
    const isAdmin = req.user?.role === "ADMIN";
    const template = await templateService.updateTemplate(
      req.params.templateId,
      req.user.sub,
      validData,
      isAdmin
    );
    res.status(200).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req, res, next) {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    await templateService.deleteTemplate(req.params.templateId, req.user.sub, isAdmin);
    res.status(200).json({ success: true, message: "Template berhasil dihapus" });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateVariables(req, res, next) {
  try {
    const variables = await templateService.getTemplateVariables(req.params.templateId, req.user.sub);
    res.status(200).json({ success: true, data: variables });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateVariables(req, res, next) {
  try {
    const { variables } = req.body;
    const template = await templateService.updateTemplateVariables(req.params.templateId, req.user.sub, variables);
    res.status(200).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function previewSwitchTemplate(req, res, next) {
  try {
    const { projectId } = req.params;
    const { targetTemplateId } = req.body;
    if (!targetTemplateId) {
      return res.status(400).json({ success: false, message: "targetTemplateId wajib disertakan" });
    }
    const preview = await templateService.previewSwitchTemplate(projectId, req.user.sub, targetTemplateId);
    res.status(200).json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

export async function commitSwitchTemplate(req, res, next) {
  try {
    const { projectId } = req.params;
    const { targetTemplateId, customMapping } = req.body;
    if (!targetTemplateId) {
      return res.status(400).json({ success: false, message: "targetTemplateId wajib disertakan" });
    }
    const updated = await templateService.commitSwitchTemplate(projectId, req.user.sub, targetTemplateId, customMapping);
    res.status(200).json({ success: true, message: "Template berhasil diperbarui", data: updated });
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
