import { fanOutTasks } from "../../../lib/http-fanout.js";
import {
  searchOpenAlex,
  searchSemanticScholar,
  searchCore,
  searchCrossref,
  searchPubMed,
  searchArxiv,
} from "../providers/index.js";

export async function runAcademicSearch({ query, expandedQuery, domainHint = "GENERAL", limitPerProvider = 8, timeoutMs = 8000 }) {
  const searchQuery = expandedQuery || query;

  const tasks = [
    () => searchOpenAlex(searchQuery, { limit: limitPerProvider, timeoutMs }),
    () => searchSemanticScholar(searchQuery, { limit: limitPerProvider, timeoutMs }),
    () => searchCore(searchQuery, { limit: limitPerProvider, timeoutMs }),
    () => searchCrossref(searchQuery, { limit: limitPerProvider, timeoutMs }),
  ];

  // Domain routing
  if (domainHint === "HEALTH") {
    tasks.push(() => searchPubMed(searchQuery, { limit: limitPerProvider, timeoutMs }));
  } else if (domainHint === "AI_CS") {
    tasks.push(() => searchArxiv(searchQuery, { limit: limitPerProvider, timeoutMs }));
  } else {
    // GENERAL: include a small sample from both
    tasks.push(() => searchPubMed(searchQuery, { limit: 4, timeoutMs }));
    tasks.push(() => searchArxiv(searchQuery, { limit: 4, timeoutMs }));
  }

  const results = await fanOutTasks(tasks, timeoutMs + 2000);

  const rawPapers = [];
  for (const r of results) {
    if (r.status === "success" && Array.isArray(r.value)) {
      rawPapers.push(...r.value);
    }
  }

  return rawPapers;
}
