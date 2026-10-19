import { Router } from 'express';
import * as controller from '../controllers/charactersController';

const router = Router();

router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
