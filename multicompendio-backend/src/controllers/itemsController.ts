import { Request, Response } from 'express';
import * as itemsService from '../services/itemsService';
import * as systemsService from '../services/systemsService';
import { handleError } from '../utils/httpError';

const userOf = (req: Request): string => req.userId as string;

// ---- campos dos itens (RF12): mesmas regras dos atributos de personagem ----
export async function addField(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await systemsService.addAttribute(req.params.id, req.body, userOf(req), 'item_field'));
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateField(req: Request, res: Response): Promise<void> {
  try {
    res.json(await systemsService.editAttribute(req.params.id, req.params.fieldId, req.body, userOf(req), 'item_field'));
  } catch (err) {
    handleError(res, err);
  }
}

export async function removeField(req: Request, res: Response): Promise<void> {
  try {
    await systemsService.removeAttribute(req.params.id, req.params.fieldId, userOf(req), 'item_field');
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// ---- itens (RF11) ----
export async function list(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.listItems(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await itemsService.createItem(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.getItem(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.updateItem(req.params.id, req.body, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function setVisibility(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.setItemVisibility(req.params.id, req.body?.is_public, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await itemsService.removeItem(req.params.id, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}

// ---- inventário do personagem ----
export async function inventory(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.getInventory(req.params.id, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function setInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    res.json(await itemsService.setInventoryItem(req.params.id, req.params.itemId, req.body?.quantity, userOf(req)));
  } catch (err) {
    handleError(res, err);
  }
}

export async function removeInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    await itemsService.removeInventoryItem(req.params.id, req.params.itemId, userOf(req));
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
}
