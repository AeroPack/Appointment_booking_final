import type { Request, Response, NextFunction } from 'express';
import { success, AppError } from '../../utils/response.js';
import { BotService } from './bot.service.js';
import { BotRepository } from './bot.repository.js';

const repo = new BotRepository();
const service = new BotService(repo);

function str(val: unknown): string {
  return Array.isArray(val) ? val[0] : String(val);
}

export async function getSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getSlots({
      doctor_id: req.botDoctorId!,
      from: str(req.query.from),
      to: req.query.to ? str(req.query.to) : undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function bookAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.bookAppointment({ ...req.body, doctor_id: req.botDoctorId! });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getDoctorInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getDoctorInfo(req.botDoctorId!);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function searchFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.searchFaq({
      doctor_id: req.botDoctorId!,
      query: str(req.query.query),
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function lookupPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.lookupPatient({
      phone: str(req.query.phone),
      doctor_id: req.botDoctorId!,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.auth?.userId ?? req.botDoctorId;
    if (!doctorId) {
      throw new AppError(400, 'MISSING_DOCTOR_ID', 'doctor_id is required');
    }
    const result = await service.getConfig(doctorId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateConfig(req.auth!.userId, req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function listFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listFaq(req.auth!.userId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function createFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createFaq(req.auth!.userId, req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function updateFaq(req: Request, res: Response, next: NextFunction) {
  try {
    await service.updateFaq(str(req.params.id), req.auth!.userId, req.body);
    res.json(success({ message: 'FAQ updated' }));
  } catch (err) {
    next(err);
  }
}

export async function deleteFaq(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteFaq(str(req.params.id), req.auth!.userId);
    res.json(success({ message: 'FAQ deleted' }));
  } catch (err) {
    next(err);
  }
}

export async function setTypebotEmbed(req: Request, res: Response, next: NextFunction) {
  try {
    await repo.setTypebotEmbedSnippet(str(req.params.doctorId), req.body.typebot_embed_snippet);
    res.json(success({ message: 'Typebot embed snippet updated' }));
  } catch (err) {
    next(err);
  }
}

export async function regenerateWidgetKey(req: Request, res: Response, next: NextFunction) {
  try {
    const key = await repo.regenerateWidgetKey(req.auth!.userId);
    res.json(success({ widget_key: key }));
  } catch (err) {
    next(err);
  }
}

export async function extractField(req: Request, res: Response, next: NextFunction) {
  try {
    const { text, field_type } = req.body;
    const result = await service.extractField(text, field_type);
    res.json(success({ extracted: result }));
  } catch (err) {
    next(err);
  }
}
