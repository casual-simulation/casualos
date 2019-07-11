import { User } from '@casual-simulation/causal-trees';

export interface AuxUser extends User {
    isGuest: boolean;
    channelId: string;
}
