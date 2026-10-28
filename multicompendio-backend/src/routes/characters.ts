import { Router } from 'express';
import * as controller from '../controllers/charactersController';
import * as stories from '../controllers/storiesController';

const router = Router();

router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/visibility', controller.setVisibility);

// RF08 — história de origem
router.get('/:id/story', stories.getOne);
router.put('/:id/story', stories.save);

export default router;
