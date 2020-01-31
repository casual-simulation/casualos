export interface Config {
    httpPort: number;
    target: TargetConfig;
    proxy: ProxyConfig;
}

export interface ProxyConfig {
    trust: string;
}

export interface TargetConfig {
    domain: string;
    port: number;
}
