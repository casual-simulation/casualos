import { Bot } from '@casual-simulation/aux-common';

export interface AddBotsRequest {
    namespace: string;
    bots: Bot[];
}
