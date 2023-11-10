declare namespace privo {
    const ageVerification: {
        init: (config: PartnerConfiguration) => Promise<void>;
        getStatus: (
            userIdentifier?: string,
            nickname?: string
        ) => Promise<AgeVerificationEvent>;
        run: (
            profile: AgeVerificationProfile | undefined,
            onChange: (event: AgeVerificationEvent) => void
        ) => void;
        hide: () => void;
    };

    type AgeVerificationDisplayMode =
        | 'popup'
        | 'redirect'
        | 'iframe'
        | 'iframe-modal';

    interface AgeVerificationEvent {
        status: AgeVerificationStatus;
        profile?: AgeVerificationProfile;
    }

    interface AgeVerificationProfile {
        userIdentifier?: string;
        nickname?: string;
        ageGateIdentifier?: string;
        firstName?: string;
        email?: string;
        birthDateYYYYMMDD?: string;
        birthDateYYYYMM?: string;
        birthDateYYYY?: string;
        age?: number;
        countryCode?: string;
        phoneNumber?: string;
    }

    type AgeVerificationStatus =
        | 'Undefined'
        | 'Pending'
        | 'Confirmed'
        | 'Declined'
        | 'Canceled';

    interface AgeVerificationStoreData {
        serviceIdentifier: string;
        displayMode: AgeVerificationDisplayMode;
        sourceOrigin?: string;
        redirectUrl?: string;
        ageEstimationToken?: string;
        profile?: AgeVerificationProfile;
    }

    interface PartnerConfiguration {
        serviceIdentifier: string;
        displayMode: AgeVerificationDisplayMode;
        containerId?: string;
        publicUrl?: string;
        redirectUrl?: string;
    }
}
