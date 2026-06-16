import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { TagsService } from './tags.service.js';
import { TagsRepository } from './tags.repository.js';

const repo = new TagsRepository();
export const tagsService = new TagsService(repo);

export async function createTag(req: Request, res: Response, next: NextFunction) {
  try {
    const tag = await tagsService.createTag(req.auth!.clinicId, req.body);
    res.status(201).json(success(tag));
  } catch (err) {
    next(err);
  }
}

export async function listTags(req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await tagsService.listTags(req.auth!.clinicId);
    res.json(success(tags));
  } catch (err) {
    next(err);
  }
}

export async function getTag(req: Request, res: Response, next: NextFunction) {
  try {
    const tag = await tagsService.getTag(req.params.id as string, req.auth!.clinicId);
    res.json(success(tag));
  } catch (err) {
    next(err);
  }
}

export async function updateTag(req: Request, res: Response, next: NextFunction) {
  try {
    const tag = await tagsService.updateTag(req.params.id as string, req.auth!.clinicId, req.body);
    res.json(success(tag));
  } catch (err) {
    next(err);
  }
}

export async function deleteTag(req: Request, res: Response, next: NextFunction) {
  try {
    await tagsService.deleteTag(req.params.id as string, req.auth!.clinicId);
    res.json(success(null));
  } catch (err) {
    next(err);
  }
}

export async function assignTag(req: Request, res: Response, next: NextFunction) {
  try {
    await tagsService.assignTag(req.params.userId as string, req.body.tag_id, req.auth!.userId);
    res.status(201).json(success(null));
  } catch (err) {
    next(err);
  }
}

export async function unassignTag(req: Request, res: Response, next: NextFunction) {
  try {
    await tagsService.unassignTag(req.params.userId as string, req.params.tagId as string);
    res.json(success(null));
  } catch (err) {
    next(err);
  }
}

export async function listUserTags(req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await tagsService.listUserTags(req.params.userId as string);
    res.json(success(tags));
  } catch (err) {
    next(err);
  }
}
