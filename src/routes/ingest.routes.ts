import path from 'path';
import { Router } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { ingestLimiter } from '../middleware/rateLimit.middleware';
import { handleFileIngest, handleTextIngest } from '../controllers/ingest.controller';
import config from '../config';

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx'];

const storage = multer.diskStorage({
  destination: config.paths.uploads,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

const router = Router();

// POST /api/ingest/file  → Upload a file (form-data, field: "file")
// POST /api/ingest/text  → Send raw text as JSON body
router.post('/file', ingestLimiter, upload.single('file'), handleFileIngest);
router.post('/text', ingestLimiter, handleTextIngest);

export default router;
