import { Router } from 'express';
import * as controller from '../controllers/itemsController';
import * as pdf from '../controllers/pdfController';

const router = Router();

router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/visibility', controller.setVisibility);
router.get('/:id/pdf', pdf.itemPdf); // bloco de estatísticas em PDF (RF13)

export default router;
