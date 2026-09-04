import { execFile, exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { sanitizeAcademicText } from "../lib/academic-cleaner.js";

const execPromise = util.promisify(exec);

function getMineruCmd() {
  if (process.env.MINERU_PATH) return `"${process.env.MINERU_PATH}"`;

  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || "";
    const appData = process.env.APPDATA || "";
    const localCandidates = [
      path.join(appData, "Python", "Python311", "Scripts", "mineru.exe"),
      path.join(userProfile, "AppData", "Roaming", "Python", "Python311", "Scripts", "mineru.exe"),
      path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python311", "Scripts", "mineru.exe"),
    ];

    for (const p of localCandidates) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
    return null;
  }

  // Linux / Docker / macOS
  const linuxCandidates = [
    "/usr/local/bin/mineru",
    "/usr/bin/mineru",
    "/opt/conda/bin/mineru",
  ];
  for (const p of linuxCandidates) {
    if (fs.existsSync(p)) return `"${p}"`;
  }

  return "mineru";
}

/**
 * Service Ekstraksi PDF menggunakan MinerU (OpenDataLab) / GROBID bridge
 * Menghasilkan JSON terstruktur berisi semua Bab, Sub-bab, Tabel HTML, Formula LaTeX, & Paragraf per Halaman.
 */
export async function extractWithMinerU(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    return { success: false, error: "File tidak ditemukan" };
  }

  const mineruBin = getMineruCmd();
  if (!mineruBin) {
    // Graceful skip — tidak menunda waktu eksekusi
    return { success: false, error: "MinerU CLI tidak terpasang di host ini. Fallback ke ekstraksi terstruktur standar." };
  }

  const outputDir = path.join(path.dirname(absolutePath), `mineru_${Date.now()}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 1. Eksekusi CLI mineru dengan backend pipeline (CPU/GPU) dengan timeout aman
    const cmd = `${mineruBin} -p "${absolutePath}" -o "${outputDir}" -b pipeline`;
    console.log(`[MinerU] Menjalankan ekstraksi dokumen: ${cmd}`);

    await execPromise(cmd, { timeout: 15000 }); // Max 15 detik untuk menghindari HTTP timeout

    // 2. Cari file output JSON dan Markdown dari MinerU
    const subDirs = fs.readdirSync(outputDir);
    let resultFolder = outputDir;

    for (const sub of subDirs) {
      const fullSub = path.join(outputDir, sub);
      if (fs.statSync(fullSub).isDirectory()) {
        resultFolder = fullSub;
        break;
      }
    }

    const files = fs.readdirSync(resultFolder);
    const contentListFile = files.find((f) => f.endsWith("_content_list.json"));
    const middleJsonFile = files.find((f) => f.endsWith("_middle.json"));
    const markdownFile = files.find((f) => f.endsWith(".md"));

    let contentList = [];
    let fullMarkdown = "";

    if (contentListFile) {
      const raw = fs.readFileSync(path.join(resultFolder, contentListFile), "utf8");
      contentList = JSON.parse(raw);
    }

    if (markdownFile) {
      fullMarkdown = fs.readFileSync(path.join(resultFolder, markdownFile), "utf8");
    }

    // 3. Bangun Sub-bab, Tabel, Formula, dan Gambar Terstruktur dari contentList MinerU
    const sections = [];
    const extractedImages = [];
    let currentSection = { heading: "Bagian Awal", page: 1, content: "" };

    for (const item of contentList) {
      const itemType = item.type || "text";
      const rawText = item.text || item.content || item.table_body || "";
      const itemText = sanitizeAcademicText(rawText);
      const itemPage = (item.page_idx !== undefined ? item.page_idx + 1 : item.page) || 1;

      // Handle Image / Figure
      if (itemType === "image" || item.img_path) {
        const rawImgPath = item.img_path || "";
        let webImgUrl = "";
        if (rawImgPath) {
          const imgFullPath = path.join(resultFolder, rawImgPath);
          if (fs.existsSync(imgFullPath)) {
            const uploadsIdx = imgFullPath.indexOf("uploads");
            if (uploadsIdx !== -1) {
              webImgUrl = "/" + imgFullPath.slice(uploadsIdx).replace(/\\/g, "/");
            }
          }
        }
        const captionText = item.image_caption || itemText || "Gambar / Diagram Hasil Penelitian";
        extractedImages.push({
          src: webImgUrl,
          caption: sanitizeAcademicText(captionText),
          page: itemPage,
        });
        if (webImgUrl) {
          currentSection.content += `\n\n![${sanitizeAcademicText(captionText)}](${webImgUrl})\n*Gambar (Hal. ${itemPage}): ${sanitizeAcademicText(captionText)}*\n\n`;
        }
        continue;
      }

      // Handle Table
      if (itemType === "table" || item.table_body || item.table_caption) {
        const tableCaption = item.table_caption ? `\n**[Tabel] ${sanitizeAcademicText(item.table_caption)}**\n` : "\n**[Tabel Hasil Riset]**\n";
        const tableBody = item.table_body || itemText;
        currentSection.content += `${tableCaption}\n${tableBody}\n\n`;
        continue;
      }

      // Handle Equation / Formula
      if (itemType === "equation" || itemType === "formula") {
        currentSection.content += `\n$$\n${itemText}\n$$\n`;
        continue;
      }

      if (itemType === "title" || itemType === "heading" || /^(\d+\.|\b[A-Z]\.|\bBAB\b)/i.test(itemText.trim())) {
        if (currentSection.content.trim().length > 0) {
          sections.push({ ...currentSection, content: currentSection.content.trim() });
        }
        currentSection = {
          heading: itemText.trim(),
          page: itemPage,
          content: "",
        };
      } else {
        currentSection.content += (itemText + "\n");
      }
    }

    if (currentSection.content.trim().length > 0) {
      sections.push({ ...currentSection, content: currentSection.content.trim() });
    }

    return {
      success: true,
      method: "MINERU_PIPELINE",
      sections,
      images: extractedImages,
      contentList,
      fullMarkdown: sanitizeAcademicText(fullMarkdown),
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[MinerU] Eksekusi CLI MinerU belum siap atau gagal, menggunakan fallback:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}
