import { Request, Response } from 'express';
import * as systemsService from '../services/systemsService';
import { handleError } from '../utils/httpError';

// Todas as rotas de sistemas passam por requireAuth, então req.userId
// sempre existe aqui.
const userOf = (req: Request): string => req.userId as string;

// POST /systems — RF01: cadastro (o proprietário é o usuário autenticado)
export async function create(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await systemsService.registerSystem(req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// PATCH /systems/:id — edita as demais propriedades do sistema
export async function update(req: Request, res: Response): Promise<void> {
  try {
    res.json(await systemsService.updateSystem(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// POST /systems/:id/attributes — RF02 + RF03: adiciona um atributo ao sistema
export async function addAttribute(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await systemsService.addAttribute(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /systems
export async function list(req: Request, res: Response): Promise<void> {
  try {
    res.json(await systemsService.listAllSystems(userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// GET /systems/:id
export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await systemsService.getSystem(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id — RF06
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await systemsService.removeSystem(req.params.id, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id/attributes/:attributeId
export async function removeAttribute(req: Request, res: Response): Promise<void> {
  try {
    await systemsService.removeAttribute(req.params.id, req.params.attributeId, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// PATCH /systems/:id/attributes/:attributeId — RF05
export async function updateAttribute(req: Request, res: Response): Promise<void> {
  try {
    res.json(
      await systemsService.editAttribute(
        req.params.id,
        req.params.attributeId,
        req.body,
        userOf(req),
      ),
    );
  } catch (err) {
    handleError(res, err);
  }
}
