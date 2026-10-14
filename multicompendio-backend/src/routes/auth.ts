import { Router } from 'express';
import * as controller from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);

export default router;
