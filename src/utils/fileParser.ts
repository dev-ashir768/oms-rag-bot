import fs from 'fs/promises';
import path from 'path';

type Parser = (filePath: string) => Promise<string>;

async function parseTxt(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

async function parsePdf(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { path: string }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

const PARSERS: Record<string, Parser> = {
  '.txt': parseTxt,
  '.md': parseTxt,
  '.pdf': parsePdf,
  '.docx': parseDocx,
};

export async function parseFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const parser = PARSERS[ext];
  if (!parser) throw new Error(`Unsupported file type: ${ext}. Allowed: ${Object.keys(PARSERS).join(', ')}`);
  return parser(filePath);
}
