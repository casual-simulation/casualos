import { LoginError } from '@casual-simulation/causal-trees';

export type AuxChannelErrorType = LoginError | AuxGeneralErrorType;

export interface AuxGeneralErrorType {
    type: 'general';
    message: string;
}
