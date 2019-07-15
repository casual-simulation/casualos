export interface User {
    id: string;
    username: string;
    token: string;
    name: string;
}

export interface DeviceToken extends User {
    grant?: string;
    isGuest?: boolean;
}
