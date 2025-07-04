import { AuthUser } from '../../../../../shared/types/auth-user'; // adjust path as needed

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
