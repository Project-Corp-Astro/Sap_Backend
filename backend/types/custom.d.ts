// Type declarations for modules without TypeScript definitions

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: any;
  }
  
  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;
  
  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): string | JwtPayload;
  
  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: object;
    encoding?: string;
    [key: string]: any;
  }
  
  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | RegExp | Array<string | RegExp>;
    clockTimestamp?: number;
    clockTolerance?: number;
    complete?: boolean;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    nonce?: string;
    subject?: string;
    [key: string]: any;
  }
  
  export class JsonWebTokenError extends Error {
    inner: Error;
    constructor(message: string, error?: Error);
  }
  
  export class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;
    constructor(message: string, expiredAt: Date);
  }
}

declare module 'xss-clean' {
  import { RequestHandler } from 'express';
  
  function xss(): RequestHandler;
  export = xss;
}

declare module 'hpp' {
  import { RequestHandler } from 'express';
  
  interface HppOptions {
    whitelist?: string[];
    checkBody?: boolean;
    checkBodyOnlyForContentType?: string;
    checkQuery?: boolean;
    [key: string]: any;
  }
  
  function hpp(options?: HppOptions): RequestHandler;
  export = hpp;
}
