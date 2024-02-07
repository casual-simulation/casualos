import { PrivacyFeatures } from '@casual-simulation/aux-common';

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
    displayName: string;
    email: string;
    phoneNumber: string;
    hasActiveSubscription: boolean;
    subscriptionTier: string;
    privacyFeatures: PrivacyFeatures;
}

export interface AppService {
    userId: string;
    service: string;
}
