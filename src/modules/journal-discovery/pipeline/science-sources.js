import { searchPubMed, searchArxiv } from "../providers/index.js";
import { fanOutTasks } from "../../../lib/http-fanout.js";

export async function runScienceSourcesSearch(query, { domainHint = "GENERAL", limit = 8, timeoutMs = 8000 } = {}) {
  const tasks = [];

  if (domainHint === "HEALTH" || domainHint === "GENERAL") {
    tasks.push(() => searchPubMed(query, { limit, timeoutMs }));
  }

  if (domainHint === "AI_CS" || domainHint === "GENERAL") {
    tasks.push(() => searchArxiv(query, { limit, timeoutMs }));
  }

  const results = await fanOutTasks(tasks, timeoutMs + 1000);
  const papers = [];

  for (const r of results) {
    if (r.status === "success" && Array.isArray(r.value)) {
      papers.push(...r.value);
    }
  }

  return papers;
}
