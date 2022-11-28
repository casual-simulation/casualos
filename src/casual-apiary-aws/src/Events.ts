export const LOGIN = 'login';
export const LOGIN_RESULT = 'login_result';
export const MESSAGE = 'message';

export interface WebSocketEvent {
    type: string;
}

export interface LoginPacket {
    type: typeof LOGIN;
    sessionId: string;
    username: string;
    token: string;
}

export interface LoginResultPacket {
    type: typeof LOGIN_RESULT;
}

export interface MessagePacket {
    type: typeof MESSAGE;
    channel: string;
    data: any;
}

export type Packet = LoginPacket | LoginResultPacket | MessagePacket;
