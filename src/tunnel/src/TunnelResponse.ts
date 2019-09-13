export type TunnelMessage = TunnelConnected | TunnelError;

export interface TunnelError {
    type: 'error';
    message: string;
}

export interface TunnelConnected {
    type: 'connected';
}
