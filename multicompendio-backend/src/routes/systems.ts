import { Router } from 'express';
import * as controller from '../controllers/systemsController';
import * as charactersController from '../controllers/charactersController';

const router = Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/attributes', controller.addAttribute);
router.patch('/:id/attributes/:attributeId', controller.updateAttribute);
router.delete('/:id/attributes/:attributeId', controller.removeAttribute);

// Personagens de um sistema (RF09 a RF14)
router.get('/:id/characters', charactersController.list);
router.post('/:id/characters', charactersController.create);

export default router;
