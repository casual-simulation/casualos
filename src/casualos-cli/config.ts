export interface CliConfig {
    get(key: string): any;
    set(key: string, value: any): void;
}
