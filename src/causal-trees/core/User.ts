export interface User {
    id: string;
    username: string;
    token: string;
    name: string;
}

export interface DeviceToken {
    id: string;
    username: string;
    token: string;
    grant?: string;
}
