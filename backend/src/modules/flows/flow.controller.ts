import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { FlowService } from './flow.service.js';
import { FlowRepository } from './flow.repository.js';
import type { FlowGraph } from './flow.node-schemas.js';

const repo = new FlowRepository();
const service = new FlowService(repo);

function str(val: unknown): string {
  return Array.isArray(val) ? val[0] : String(val);
}

export async function createFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createFlow(
      req.auth!.userId,
      req.body.name,
      req.body.trigger_type
    );
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function listFlows(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listFlowsByDoctor(req.auth!.userId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getFlowDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getFlowDetail(str(req.params.flowId), req.auth!.userId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getVersion(
      str(req.params.flowId),
      str(req.params.versionId),
      req.auth!.userId
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function autosaveDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.autosaveDraft(
      str(req.params.flowId),
      str(req.params.versionId),
      req.auth!.userId,
      req.body as FlowGraph
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getOrCreateDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getOrCreateDraft(str(req.params.flowId), req.auth!.userId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function publishVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.publishVersion(
      str(req.params.flowId),
      str(req.params.versionId),
      req.auth!.userId
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function rollbackToVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.rollbackToVersion(
      str(req.params.flowId),
      req.body.version_id,
      req.auth!.userId
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}
