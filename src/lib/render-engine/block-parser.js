import fs from "fs";
import path from "path";

/**
 * Helper to extract PNG/JPEG dimensions from buffer without external dependencies
 */
export function getImageDimensions(buffer) {
  if (!buffer || buffer.length < 24) return { width: 500, height: 320 };

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height };
  }

  // JPEG / JPG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      // SOF0 - SOF3, SOF5 - SOF7, SOF9 - SOF11, SOF13 - SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
      }
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  // Fallback default
  return { width: 500, height: 320 };
}

/**
 * Memecah teks sub-bab menjadi block terstruktur:
 * - IMAGE: { type: 'IMAGE', caption: string, src: string }
 * - TABLE: { type: 'TABLE', caption: string, headers: string[], rows: string[][] }
 * - PARAGRAPH: { type: 'PARAGRAPH', text: string }
 */
export function parseSubchapterBlocks(rawText = "") {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split("\n");
  const blocks = [];

  let currentParaLines = [];
  let currentTableLines = [];
  let pendingCaption = "";

  let inHtmlTable = false;
  let currentHtmlTableLines = [];

  const flushParagraph = () => {
    if (currentParaLines.length > 0) {
      const text = currentParaLines.join("\n").trim();
      if (text) {
        blocks.push({ type: "PARAGRAPH", text });
      }
      currentParaLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      const parsedTable = parseMarkdownTableLines(currentTableLines, pendingCaption);
      if (parsedTable) {
        blocks.push(parsedTable);
      }
      currentTableLines = [];
      pendingCaption = "";
    }
  };

  const flushHtmlTable = () => {
    if (currentHtmlTableLines.length > 0) {
      const parsedHtml = parseHtmlTable(currentHtmlTableLines.join("\n"), pendingCaption);
      if (parsedHtml) {
        blocks.push(parsedHtml);
      }
      currentHtmlTableLines = [];
      pendingCaption = "";
      inHtmlTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for HTML Table start or inside HTML table
    if (trimmed.includes("<table") || inHtmlTable) {
      if (!inHtmlTable) {
        flushParagraph();
        flushTable();
        inHtmlTable = true;
      }
      currentHtmlTableLines.push(line);
      if (trimmed.includes("</table>")) {
        flushHtmlTable();
      }
      continue;
    }

    // Check for Image markdown: ![caption](src)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      flushParagraph();
      flushTable();
      blocks.push({
        type: "IMAGE",
        caption: imgMatch[1].trim(),
        src: imgMatch[2].trim(),
      });
      continue;
    }

    // Check for Table Caption: e.g., "Tabel 2.1: Judul Tabel"
    const tableCaptionMatch = trimmed.match(/^(?:Tabel|Table)\s+(\d+(?:\.\d+)*\s*:\s*.+)$/i);
    if (tableCaptionMatch && i + 1 < lines.length && (lines[i + 1].trim().startsWith("|") || lines[i + 1].trim().includes("<table"))) {
      flushParagraph();
      flushTable();
      pendingCaption = trimmed;
      continue;
    }

    // Check for Markdown table row: | ... |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      currentTableLines.push(trimmed);
      continue;
    }

    // If we were reading a table and this line is not a table row
    if (currentTableLines.length > 0) {
      flushTable();
    }

    // Standard paragraph line
    currentParaLines.push(line);
  }

  flushParagraph();
  flushTable();
  flushHtmlTable();

  return blocks;
}

/**
 * Parse tabel HTML dengan dukungan colspan dan rowspan (Merge Cells)
 */
function parseHtmlTable(htmlText, fallbackCaption = "") {
  const capMatch = htmlText.match(/data-caption=["'](.*?)["']/i);
  const caption = capMatch ? capMatch[1] : fallbackCaption;
  const theadMatch = htmlText.match(/<thead>([\s\S]*?)<\/thead>/i);
  const tbodyMatch = htmlText.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const colgroupMatch = htmlText.match(/<colgroup>([\s\S]*?)<\/colgroup>/i);

  const colWidths = [];
  if (colgroupMatch) {
    const colRegex = /<col[^>]*style=["'][^"']*width:\s*(\d+(?:\.\d+)?)%[^"']*["'][^>]*>/gi;
    let colM;
    while ((colM = colRegex.exec(colgroupMatch[1])) !== null) {
      colWidths.push(parseFloat(colM[1]));
    }
  }

  function parseRows(sectionHtml, tag) {
    if (!sectionHtml) return [];
    const rows = [];
    const trRegex = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(sectionHtml)) !== null) {
      const cellRegex = new RegExp('<(?:' + tag + ')(?:\\s+([^>]*))?>([\\s\\S]*?)<\\/(?:' + tag + ')>', 'gi');
      const rowCells = [];
      let cMatch;
      while ((cMatch = cellRegex.exec(trMatch[1])) !== null) {
        const attrs = cMatch[1] || '';
        const text = cMatch[2].replace(/<[^>]*>/g, '').trim();
        const cs = attrs.match(/colspan=["']?(\d+)["']?/i);
        const rs = attrs.match(/rowspan=["']?(\d+)["']?/i);
        const ws = attrs.match(/width:\s*(\d+(?:\.\d+)?)%/i) || attrs.match(/width=["']?(\d+(?:\.\d+)?)%?["']?/i);
        rowCells.push({
          text,
          colSpan: cs ? parseInt(cs[1], 10) : 1,
          rowSpan: rs ? parseInt(rs[1], 10) : 1,
          widthPercent: ws ? parseFloat(ws[1]) : undefined,
        });
      }
      if (rowCells.length > 0) rows.push(rowCells);
    }
    return rows;
  }

  const headerRows = parseRows(theadMatch ? theadMatch[1] : '', 'th|td');
  const bodyRows = parseRows(tbodyMatch ? tbodyMatch[1] : htmlText, 'td|th');

  const headers = headerRows.length > 0 ? headerRows[headerRows.length - 1].map((c) => c.text) : [];
  const rows = bodyRows.map((r) => r.map((c) => c.text));

  return {
    type: "TABLE",
    caption,
    headers,
    rows,
    headerRows,
    bodyRows,
    colWidths: colWidths.length > 0 ? colWidths : undefined,
  };
}

/**
 * Parse baris-baris Markdown table menjadi headers dan rows
 */
function parseMarkdownTableLines(tableLines, caption = "") {
  if (!tableLines || tableLines.length < 2) return null;

  // Baris pertama = Header
  const rawHeaders = tableLines[0]
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

  // Lewati baris separator (|---|---|...) jika ada
  let startIndex = 1;
  if (tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1])) {
    startIndex = 2;
  }

  const rows = [];
  for (let i = startIndex; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (!line) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }

  return {
    type: "TABLE",
    caption: caption || "",
    headers: rawHeaders,
    rows,
    headerRows: [rawHeaders.map((h) => ({ text: h, colSpan: 1, rowSpan: 1 }))],
    bodyRows: rows.map((r) => r.map((c) => ({ text: c, colSpan: 1, rowSpan: 1 }))),
  };
}

/**
 * Mengubah blok teks/gambar/tabel menjadi elemen DOCX yang rapi
 */
export function renderBlocksToDocx(rawText, docxLib, options = {}) {
  const {
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle,
  } = docxLib;

  const blocks = parseSubchapterBlocks(rawText);
  const elements = [];

  const defaultFirstLineIndent = options.firstLineIndent !== false ? 720 : 0;

  for (const block of blocks) {
    if (block.type === "PARAGRAPH") {
      // Split into individual paragraphs by double newline
      const paras = block.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      for (const p of paras) {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: p, size: 24, font: "Times New Roman" })],
            alignment: AlignmentType.JUSTIFIED,
            indent: defaultFirstLineIndent ? { firstLine: defaultFirstLineIndent } : undefined,
            spacing: { line: 360, before: 60, after: 120 },
          })
        );
      }
    } else if (block.type === "IMAGE") {
      let imgBuffer = null;
      try {
        if (block.src.startsWith("data:image/")) {
          const b64 = block.src.replace(/^data:image\/\w+;base64,/, "");
          imgBuffer = Buffer.from(b64, "base64");
        } else if (block.src.startsWith("/uploads/") || block.src.startsWith("uploads/")) {
          const cleanRel = block.src.replace(/^[/\\]+/, "");
          const localPath = path.resolve(cleanRel);
          if (fs.existsSync(localPath)) {
            imgBuffer = fs.readFileSync(localPath);
          }
        } else if (fs.existsSync(block.src)) {
          imgBuffer = fs.readFileSync(block.src);
        }
      } catch (err) {
        console.warn("[renderBlocksToDocx] Gagal membaca gambar:", block.src, err.message);
      }

      if (imgBuffer && ImageRun) {
        const { width: rawW, height: rawH } = getImageDimensions(imgBuffer);
        const maxWidth = 480;
        let scaledW = rawW;
        let scaledH = rawH;
        if (scaledW > maxWidth) {
          scaledH = Math.round((scaledH * maxWidth) / scaledW);
          scaledW = maxWidth;
        }

        // Image paragraph (Centered)
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: {
                  width: scaledW,
                  height: scaledH,
                },
              }),
            ],
          })
        );

        // Caption paragraph (Indonesian Academic Convention: Dibawah gambar)
        if (block.caption) {
          elements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 180 },
              children: [
                new TextRun({
                  text: block.caption,
                  italics: true,
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
            })
          );
        }
      } else {
        // Fallback placeholder text if image file missing
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `[Gambar: ${block.caption || block.src}]`,
                italics: true,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          })
        );
      }
    } else if (block.type === "TABLE") {
      // Caption paragraph (Indonesian Academic Convention: Diatas tabel)
      if (block.caption) {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 180, after: 60 },
            children: [
              new TextRun({
                text: block.caption,
                bold: true,
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      }

      const tableRows = [];

      // Header rows (supporting merged cells)
      const headerRowsData = block.headerRows && block.headerRows.length > 0
        ? block.headerRows
        : (block.headers && block.headers.length > 0 ? [block.headers.map((h) => ({ text: h, colSpan: 1, rowSpan: 1 }))] : []);

      for (const hRow of headerRowsData) {
        tableRows.push(
          new TableRow({
            children: hRow.map(
              (cell, cIdx) => {
                const w = cell.widthPercent || (block.colWidths ? block.colWidths[cIdx] : undefined);
                return new TableCell({
                  columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                  rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                  width: w ? { size: Math.round(w), type: WidthType.PERCENTAGE } : undefined,
                  children: [
                    new Paragraph({
                      text: cell.text || "",
                      alignment: AlignmentType.CENTER,
                      run: { bold: true, size: 20, font: "Times New Roman" },
                    }),
                  ],
                });
              }
            ),
          })
        );
      }

      // Body data rows (supporting merged cells)
      const bodyRowsData = block.bodyRows && block.bodyRows.length > 0
        ? block.bodyRows
        : (block.rows || []).map((r) => r.map((c) => ({ text: c, colSpan: 1, rowSpan: 1 })));

      for (const bRow of bodyRowsData) {
        tableRows.push(
          new TableRow({
            children: bRow.map(
              (cell, cIdx) => {
                const w = cell.widthPercent || (block.colWidths ? block.colWidths[cIdx] : undefined);
                return new TableCell({
                  columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
                  rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
                  width: w ? { size: Math.round(w), type: WidthType.PERCENTAGE } : undefined,
                  children: [
                    new Paragraph({
                      text: cell.text || "",
                      alignment: AlignmentType.LEFT,
                      run: { size: 19, font: "Times New Roman" },
                    }),
                  ],
                });
              }
            ),
          })
        );
      }

      if (tableRows.length > 0) {
        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
        // Add spacing after table
        elements.push(
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [],
          })
        );
      }
    }
  }

  return elements;
}

/**
 * Mengubah blok teks/gambar/tabel menjadi sintaks LaTeX
 * Mengumpulkan berkas gambar yang perlu disalin ke zip LaTeX (folder figures/)
 */
export function renderBlocksToLatex(rawText, escapeLatexFn, options = {}) {
  const blocks = parseSubchapterBlocks(rawText);
  const latexLines = [];
  const figureFiles = [];

  let figCounter = options.figStartNum || 1;
  let tabCounter = options.tabStartNum || 1;
  const chapterPrefix = options.chapterPrefix || "2";

  for (const block of blocks) {
    if (block.type === "PARAGRAPH") {
      latexLines.push(block.text);
      latexLines.push("");
    } else if (block.type === "IMAGE") {
      let figName = `figure_${chapterPrefix}_${figCounter}.png`;
      let imgBuffer = null;

      try {
        if (block.src.startsWith("data:image/")) {
          const b64 = block.src.replace(/^data:image\/\w+;base64,/, "");
          imgBuffer = Buffer.from(b64, "base64");
        } else if (block.src.startsWith("/uploads/") || block.src.startsWith("uploads/")) {
          const cleanRel = block.src.replace(/^[/\\]+/, "");
          const localPath = path.resolve(cleanRel);
          if (fs.existsSync(localPath)) {
            imgBuffer = fs.readFileSync(localPath);
            const ext = path.extname(localPath) || ".png";
            figName = `figure_${chapterPrefix}_${figCounter}${ext}`;
          }
        }
      } catch (e) {
        console.warn("[renderBlocksToLatex] Gagal membaca gambar:", e.message);
      }

      if (imgBuffer) {
        figureFiles.push({
          zipPath: `figures/${figName}`,
          buffer: imgBuffer,
        });

        const captionText = escapeLatexFn(block.caption || `Gambar ${chapterPrefix}.${figCounter}`);
        const labelText = `fig:${chapterPrefix}_${figCounter}`;

        latexLines.push(`\\begin{figure}[htbp]`);
        latexLines.push(`  \\centering`);
        latexLines.push(`  \\includegraphics[width=0.85\\textwidth]{figures/${figName}}`);
        latexLines.push(`  \\caption{${captionText}}`);
        latexLines.push(`  \\label{${labelText}}`);
        latexLines.push(`\\end{figure}`);
        latexLines.push("");
        figCounter++;
      }
    } else if (block.type === "TABLE") {
      const headerRowsData = block.headerRows && block.headerRows.length > 0
        ? block.headerRows
        : (block.headers && block.headers.length > 0 ? [block.headers.map((h) => ({ text: h, colSpan: 1, rowSpan: 1 }))] : []);

      const bodyRowsData = block.bodyRows && block.bodyRows.length > 0
        ? block.bodyRows
        : (block.rows || []).map((r) => r.map((c) => ({ text: c, colSpan: 1, rowSpan: 1 })));

      let maxCols = 1;
      for (const r of [...headerRowsData, ...bodyRowsData]) {
        const spanSum = r.reduce((sum, c) => sum + (c.colSpan || 1), 0);
        if (spanSum > maxCols) maxCols = spanSum;
      }

      const colSpec = "|c|" + "X|".repeat(Math.max(0, maxCols - 1));
      const captionText = escapeLatexFn(block.caption || `Tabel ${chapterPrefix}.${tabCounter}`);
      const labelText = `tab:${chapterPrefix}_${tabCounter}`;

      latexLines.push(`\\begin{table}[htbp]`);
      latexLines.push(`  \\centering`);
      latexLines.push(`  \\small`);
      latexLines.push(`  \\caption{${captionText}}`);
      latexLines.push(`  \\label{${labelText}}`);
      latexLines.push(`  \\begin{tabularx}{\\textwidth}{${colSpec}}`);
      latexLines.push(`    \\hline`);

      for (const hRow of headerRowsData) {
        const cells = hRow.map((c) => {
          const escText = `\\textbf{${escapeLatexFn(c.text || "")}}`;
          if (c.colSpan > 1) {
            return `\\multicolumn{${c.colSpan}}{|c|}{${escText}}`;
          }
          return escText;
        });
        latexLines.push(`    ${cells.join(" & ")} \\\\ \\hline`);
      }

      for (const bRow of bodyRowsData) {
        const cells = bRow.map((c) => {
          const escText = escapeLatexFn(c.text || "");
          if (c.colSpan > 1) {
            return `\\multicolumn{${c.colSpan}}{|l|}{${escText}}`;
          }
          if (c.rowSpan > 1) {
            return `\\multirow{${c.rowSpan}}{*}{${escText}}`;
          }
          return escText;
        });
        latexLines.push(`    ${cells.join(" & ")} \\\\ \\hline`);
      }

      latexLines.push(`  \\end{tabularx}`);
      latexLines.push(`\\end{table}`);
      latexLines.push("");
      tabCounter++;
    }
  }

  return {
    latexString: latexLines.join("\n"),
    figureFiles,
  };
}
