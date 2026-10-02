import { Request, Response } from 'express';
import * as systemsService from '../services/systemsService';
import { ValidationError, NotFoundError, ConflictError } from '../services/systemsService';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Erro interno.' });
  }
}

// POST /systems — RF01: cadastro simplificado (nome + descrição)
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const result = await systemsService.registerSystem(req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
}

// PATCH /systems/:id — edita as demais propriedades do sistema
// (versão, proprietário, descrição, pré-configurado)
export async function update(req: Request, res: Response): Promise<void> {
  try {
    const result = await systemsService.updateSystem(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

// POST /systems/:id/attributes — RF02 + RF03: adiciona um atributo ao sistema
export async function addAttribute(req: Request, res: Response): Promise<void> {
  try {
    const attribute = await systemsService.addAttribute(req.params.id, req.body);
    res.status(201).json(attribute);
  } catch (err) {
    handleError(res, err);
  }
}

// GET /systems
export async function list(_req: Request, res: Response): Promise<void> {
  const systems = await systemsService.listAllSystems();
  res.json(systems);
}

// GET /systems/:id
export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    const result = await systemsService.getSystem(req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id — RF06
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await systemsService.removeSystem(req.params.id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// DELETE /systems/:id/attributes/:attributeId
export async function removeAttribute(req: Request, res: Response): Promise<void> {
  try {
    await systemsService.removeAttribute(req.params.id, req.params.attributeId);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// PATCH /systems/:id/attributes/:attributeId — RF05
export async function updateAttribute(req: Request, res: Response): Promise<void> {
  try {
    const updated = await systemsService.editAttribute(
      req.params.id,
      req.params.attributeId,
      req.body,
    );
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
}
