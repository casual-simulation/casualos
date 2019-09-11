export interface Config {
    httpPort: number;
    secret: string;
    loginTimeout: number;
    proxy: ProxyConfig;
}

export interface ProxyConfig {
    trust: string;
}
