import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getMe, updateMe, uploadAvatar, createDependent, getDependents, updateDependent, deleteDependent, searchPatients, createPatient } from './users.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const avatarDir = path.join(__dirname, '../../../uploads/avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.auth!.userId}-${Date.now()}${ext}`);
  },
});

const uploadAvatarFile = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
}).single('avatar');

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  date_of_birth: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

const createDependentSchema = z.object({
  name: z.string().min(1),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  relationship: z.string().optional(),
  date_of_birth: z.string().optional(),
});

const updateDependentSchema = z.object({
  name: z.string().min(1).optional(),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  relationship: z.string().optional(),
  date_of_birth: z.string().optional(),
});

const searchPatientsSchema = z.object({
  q: z.string().min(1),
});

const createPatientSchema = z.object({
  name: z.string().min(1),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
});

router.get('/users/me', authGuard, getMe);
router.patch('/users/me', authGuard, validate(updateProfileSchema), updateMe);
router.post('/users/avatar', authGuard, (req, res, next) => {
  uploadAvatarFile(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File must be under 5MB' } });
        }
        return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
      }
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: err.message } });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }
    next();
  });
}, uploadAvatar);
router.post('/users/dependents', authGuard, validate(createDependentSchema), createDependent);
router.get('/users/dependents', authGuard, getDependents);
router.patch('/users/dependents/:id', authGuard, validate(updateDependentSchema), updateDependent);
router.delete('/users/dependents/:id', authGuard, deleteDependent);
router.get('/patients/search', authGuard, requireRole('doctor', 'staff'), validate(searchPatientsSchema, 'query'), searchPatients);
router.post('/patients', authGuard, requireRole('doctor', 'staff'), validate(createPatientSchema), createPatient);

export default router;
