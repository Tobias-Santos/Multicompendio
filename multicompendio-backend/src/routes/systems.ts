import { Router } from 'express';
import * as controller from '../controllers/systemsController';
import * as charactersController from '../controllers/charactersController';
import * as sharing from '../controllers/sharingController';
import * as items from '../controllers/itemsController';

const router = Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/attributes', controller.addAttribute);
router.patch('/:id/attributes/:attributeId', controller.updateAttribute);
router.delete('/:id/attributes/:attributeId', controller.removeAttribute);

// Itens e seus campos (v1.5)
router.post('/:id/item-fields', items.addField);
router.patch('/:id/item-fields/:fieldId', items.updateField);
router.delete('/:id/item-fields/:fieldId', items.removeField);
router.get('/:id/items', items.list);
router.post('/:id/items', items.create);

// Compartilhamento (v1.4)
router.get('/:id/sharing', sharing.getSharing);
router.post('/:id/sharing/invite', sharing.createInvite);
router.delete('/:id/sharing/invite', sharing.disableInvite);
router.delete('/:id/membership', sharing.leave);

// Personagens de um sistema (RF09 a RF14)
router.get('/:id/characters', charactersController.list);
router.post('/:id/characters', charactersController.create);

export default router;
