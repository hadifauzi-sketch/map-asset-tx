import { extractDgaImportFromFile as extractDgaImportFromWorkbookFile } from "./excelImport.js";
import { extractDgaImportFromImageFile, isImportableImageFile } from "./imageImport.js";
import { extractDgaImportFromPdfFile } from "./pdfImport.js";

function isPdfFile(file) {
  const fileName = String(file?.name ?? "").toLowerCase();
  const mimeType = String(file?.type ?? "").toLowerCase();
  return fileName.endsWith(".pdf") || mimeType === "application/pdf";
}

export async function extractDgaImportFromFile(file, options = {}) {
  if (!file) {
    throw new Error("Choose a DGA report before importing.");
  }

  if (isPdfFile(file)) {
    return extractDgaImportFromPdfFile(file);
  }

  if (isImportableImageFile(file)) {
    return extractDgaImportFromImageFile(file, options);
  }

  return extractDgaImportFromWorkbookFile(file);
}
