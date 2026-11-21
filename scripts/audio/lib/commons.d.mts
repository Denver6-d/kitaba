export declare const CONTACT_URL: string;
export declare const USER_AGENT: string;
export declare const API: string;
export declare function get(url: string, opts?: { tries?: number }): Promise<Response>;
export declare function query(params: Record<string, string>): Promise<unknown>;
