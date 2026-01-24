import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/AuthService.js';
import { validate } from '../middleware/validation.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { registerSchema, loginSchema } from '@deployy/shared';

// Strict rate limiter for auth endpoints (5 requests per 15 minutes)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Check if setup is needed (no users exist)
  router.get('/setup-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hasUsers = await authService.hasUsers();
      res.json({ needsSetup: !hasUsers });
    } catch (error) {
      next(error);
    }
  });

  // Register - only works when no users exist
  router.post(
    '/register',
    authRateLimiter,
    validate(registerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body;
        const user = await authService.register(email, password);
        res.status(201).json({ user, message: 'Registration successful' });
      } catch (error) {
        next(error);
      }
    }
  );

  // Login
  router.post(
    '/login',
    authRateLimiter,
    validate(loginSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body;
        const { user, token } = await authService.login(email, password);

        // Set HTTP-only cookie
        res.cookie('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          path: '/',
        });

        res.json({ user, message: 'Login successful' });
      } catch (error) {
        next(error);
      }
    }
  );

  // Logout
  router.post('/logout', (req: Request, res: Response) => {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.json({ message: 'Logged out successfully' });
  });

  // Get current user (check auth status)
  router.get('/me', requireAuth, (req: Request, res: Response) => {
    res.json({ authenticated: true, user: req.user });
  });

  return router;
};
