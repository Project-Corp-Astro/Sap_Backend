import { IUser, UserDocument } from '../../../../shared/interfaces/user.interface';

// Fix the compatibility between UserDocument and IUser
declare module '../../../../shared/interfaces/user.interface' {
  // Make TypeScript treat UserDocument as compatible with IUser
  interface UserDocument extends Partial<IUser> {
    // Add any missing properties or methods
  }
}

// Fix the compatibility issues with Express Request
declare module 'express' {
  // Extend Express Request interface to include user property
  interface Request {
    user?: UserDocument | IUser | any;
  }
}

// Fix the compatibility issues with express-serve-static-core
declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDocument | IUser | any;
  }
  
  // Make RequestHandler accept AuthenticatedRequest
  interface ParamsDictionary {
    [key: string]: string;
  }
  
  interface RequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = any,
    Locals extends Record<string, any> = Record<string, any>
  > {
    (req: Request<P, ResBody, ReqBody, ReqQuery, Locals>, res: Response<ResBody, Locals>, next: NextFunction): void | Promise<void> | any;
  }
}

// Fix the compatibility issues with jsonwebtoken
declare module 'jsonwebtoken' {
  // Add missing function overloads
  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: SignOptions
  ): string;
}
