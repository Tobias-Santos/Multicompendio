import { Router } from 'express';
import * as controller from '../controllers/charactersController';
import * as stories from '../controllers/storiesController';
import * as items from '../controllers/itemsController';

const router = Router();

router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/visibility', controller.setVisibility);

// Inventário do personagem (v1.5)
router.get('/:id/items', items.inventory);
router.put('/:id/items/:itemId', items.setInventoryItem);
router.delete('/:id/items/:itemId', items.removeInventoryItem);

// RF08 — história de origem
router.get('/:id/story', stories.getOne);
router.put('/:id/story', stories.save);

export default router;
