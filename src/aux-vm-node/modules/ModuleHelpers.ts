import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';

export function isAdminChannel(info: RealtimeChannelInfo): boolean {
    return info.id === 'aux-admin';
}
