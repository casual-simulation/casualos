export interface UserMetadata {
    email: string;
    name: string;
    phone: string;
    avatarUrl: string;
    avatarPortraitUrl: string;
}

export interface AppMetadata {
    avatarUrl: string;
    avatarPortraitUrl: string;
    name: string;
    email: string;
    phoneNumber: string;
    hasActiveSubscription: boolean;
    subscriptionTier: string;
}

export interface AppService {
    userId: string;
    service: string;
}
