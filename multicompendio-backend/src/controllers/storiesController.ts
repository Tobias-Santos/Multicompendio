import { Request, Response } from 'express';
import * as storiesService from '../services/storiesService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// GET /characters/:id/story — RF08
export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await storiesService.getStory(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// PUT /characters/:id/story — RF08 (usado pelo salvamento automático)
export async function save(req: Request, res: Response): Promise<void> {
  try {
    res.json(await storiesService.saveStory(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}
