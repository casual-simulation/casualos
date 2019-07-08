import { User } from '@casual-simulation/causal-trees';

export interface AuxUser extends User {
    email: string;
    isGuest: boolean;
    channelId: string;
}
