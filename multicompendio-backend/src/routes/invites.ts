import { Router } from 'express';
import * as sharing from '../controllers/sharingController';

const router = Router();

router.get('/:token', sharing.previewInvite);
router.post('/:token/accept', sharing.acceptInvite);

export default router;
