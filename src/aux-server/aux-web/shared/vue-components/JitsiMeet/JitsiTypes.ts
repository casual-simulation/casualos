import type { EventEmitter } from 'events';

export interface JitsiMeetExternalAPIOptions {
    roomName?: string;
    userInfo?: JitsiParticipant;
    invitees?: JitsiParticipant[];
    devices?: any;
    onload?: () => void;
    width?: number | string;
    height?: number | string;
    parentNode?: Element;
    configOverwrite?: any;
    interfaceConfigOverwrite?: any;
    noSSL?: boolean;
    jwt?: any;
}

export interface JitsiParticipant {
    email: string;
    displayName: string;
}

export interface JitsiApi extends EventEmitter {
    executeCommand(command: string, ...args: any): void;
    dispose(): void;
}

export interface JitsiVideoConferenceJoinedEvent {
    roomName: string;
    id: string;
    displayName: string;
    avatarURL: string;
    breakoutRoom: boolean;
}

export interface JitsiVideoConferenceLeftEvent {
    roomName: string;
}