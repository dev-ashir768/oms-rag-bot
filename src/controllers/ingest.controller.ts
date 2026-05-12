import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { ingestFile, ingestText } from '../services/ingest.service';
import { IngestTextBody, MulterRequest } from '../types';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/ingest/file
// Form-data: file (field name must be "file")
// Supported: .txt .md .pdf .docx (max 10 MB)
//
// How it works:
//   1. Multer saves the uploaded file to /uploads/ temporarily
//   2. We read & parse it (txt/pdf/docx)
//   3. Split into overlapping chunks
//   4. Embed each chunk via Gemini
//   5. Save to HNSWLib vector store on disk
//   6. Delete the temp uploaded file
// ────────────────────────────────────────────────────────────────────────────
export async function handleFileIngest(
  req: MulterRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use form-data with field name "file"' });
      return;
    }

    const { path: filePath, originalname } = req.file;
    logger.info(`Ingesting file: ${originalname}`);

    const result = await ingestFile(filePath, {
      originalName: originalname,
      uploadedBy: req.ip ?? 'unknown',
    });

    // Delete temp file after successful ingest
    fs.unlink(filePath, () => {});

    res.json({
      success: true,
      message: `"${result.fileName}" ingested successfully`,
      fileName: result.fileName,
      totalChars: result.totalChars,
      totalChunks: result.totalChunks,
    });
  } catch (err) {
    // Always clean up temp file on error too
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/ingest/text
// Body: { text: string, source?: string }
//
// Use this when you don't have a file — just paste raw text directly.
// E.g., FAQ scraped from a webpage, or a policy paragraph.
// ────────────────────────────────────────────────────────────────────────────
export async function handleTextIngest(
  req: Request<unknown, unknown, IngestTextBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { text, source } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'text field is required and cannot be empty' });
      return;
    }

    logger.info(`Ingesting raw text (${text.length} chars) from: ${source ?? 'unknown'}`);

    const result = await ingestText(text, { source: source ?? 'api-text' });

    res.json({
      success: true,
      message: 'Text ingested successfully',
      totalChars: result.totalChars,
      totalChunks: result.totalChunks,
    });
  } catch (err) {
    next(err);
  }
}
