import { Router } from 'express';
import * as controller from '../controllers/systemsController';

const router = Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/attributes', controller.addAttribute);
router.patch('/:id/attributes/:attributeId', controller.updateAttribute);
router.delete('/:id/attributes/:attributeId', controller.removeAttribute);

export default router;
