export interface User {
    id: string;
    username: string;
    token: string;
    name: string;
}

export interface DeviceToken {
    username: string;
    token: string;
    grant?: string;
    isGuest?: boolean;
}
