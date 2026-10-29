import { Router } from 'express';
import * as controller from '../controllers/itemsController';

const router = Router();

router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/visibility', controller.setVisibility);

export default router;
