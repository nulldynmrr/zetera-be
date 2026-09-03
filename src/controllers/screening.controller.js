import * as screeningService from "../services/screening.service.js";

export async function screenAbstractsBatch(req, res, next) {
  try {
    const result = await screeningService.screenAbstractsBatch(req.params.projectId, req.user.sub);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function autoPopulateFramework(req, res, next) {
  try {
    const { journalIds } = req.body || {};
    const result = await screeningService.autoPopulateFramework(
      req.params.projectId,
      req.user.sub,
      journalIds || []
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
