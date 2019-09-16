export interface Config {
    httpPort: number;
    secret: string;
    loginTimeout: number;
    homeDir: string;
    proxy: ProxyConfig;
}

export interface ProxyConfig {
    trust: string;
}
