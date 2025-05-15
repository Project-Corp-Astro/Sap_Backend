// Type definitions for k6
declare module 'k6/http' {
  export interface Response {
    status: number;
    body: string | null;
    headers: Record<string, string>;
    timings: Record<string, number>;
    error: string | null;
    request: {
      method: string;
      url: string;
      params: Record<string, any>;
      body: string | null;
      headers: Record<string, string>;
    };
  }

  export interface RequestParams {
    headers?: Record<string, string>;
    tags?: Record<string, string>;
    auth?: string;
    timeout?: number;
    redirects?: number;
    cookies?: Record<string, string>;
    compression?: string;
    responseType?: string;
  }

  export function get(url: string, params?: RequestParams): Response;
  export function post(url: string, body?: any, params?: RequestParams): Response;
  export function put(url: string, body?: any, params?: RequestParams): Response;
  export function patch(url: string, body?: any, params?: RequestParams): Response;
  export function del(url: string, body?: any, params?: RequestParams): Response;
  export function head(url: string, params?: RequestParams): Response;
  export function options(url: string, params?: RequestParams): Response;
  export function request(method: string, url: string, body?: any, params?: RequestParams): Response;
  export function batch(requests: Array<{ method: string, url: string, body?: any, params?: RequestParams }>): Response[];
}

declare module 'k6' {
  export interface CheckValue {
    passes: number;
    fails: number;
  }

  export interface CheckResult {
    [key: string]: CheckValue;
  }

  export function check(val: any, sets: Record<string, (val: any) => boolean>): boolean;
  export function sleep(t: number): void;
  export function group(name: string, fn: () => void): void;
}

declare module 'k6/metrics' {
  export class Rate {
    constructor(name: string);
    add(value: number): void;
  }

  export class Counter {
    constructor(name: string);
    add(value: number): void;
  }

  export class Gauge {
    constructor(name: string);
    add(value: number): void;
  }

  export class Trend {
    constructor(name: string);
    add(value: number): void;
  }
}
