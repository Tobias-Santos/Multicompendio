import { Request, Response } from 'express';
import * as charactersService from '../services/charactersService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// GET /systems/:id/characters — RF13
export async function list(req: Request, res: Response): Promise<void> {
  try {
    res.json(await charactersService.listCharacters(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// POST /systems/:id/characters — RF09, RF10, RF11, RF12
export async function create(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await charactersService.createCharacter(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /characters/:id — RF14
export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await charactersService.getCharacter(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// PUT /characters/:id — RF15, RF16
export async function update(req: Request, res: Response): Promise<void> {
  try {
    res.json(await charactersService.updateCharacter(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /characters/:id
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await charactersService.removeCharacter(req.params.id, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}
