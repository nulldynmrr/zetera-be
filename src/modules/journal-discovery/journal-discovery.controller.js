import * as orchestrator from "./journal-discovery.orchestrator.js";

export async function searchJournalsHandler(req, res, next) {
  try {
    const { projectId } = req.params;
    const { query, domainHint, limitPerProvider } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: "Parameter query wajib diisi." });
    }

    const result = await orchestrator.searchJournals({
      projectId,
      userId: req.user.sub,
      query,
      domainHint,
      limitPerProvider: Number(limitPerProvider) || 8,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCachedSearchHandler(req, res, next) {
  try {
    const { projectId, searchId } = req.params;
    const result = await orchestrator.getCachedSearchResult({
      projectId,
      userId: req.user.sub,
      searchId,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function importCandidateHandler(req, res, next) {
  try {
    const { projectId } = req.params;
    const { candidate } = req.body;

    if (!candidate || !candidate.title) {
      return res.status(400).json({ success: false, message: "Data kandidat paper wajib diisi." });
    }

    const result = await orchestrator.importCandidate({
      projectId,
      userId: req.user.sub,
      candidate,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function quickSummarizeHandler(req, res, next) {
  try {
    const { projectId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "File PDF jurnal wajib disertakan." });
    }

    const result = await orchestrator.summarizeUploadedJournal({
      projectId,
      userId: req.user.sub,
      file,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
