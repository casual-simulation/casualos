import { LoginError } from '@casual-simulation/aux-common';

export type AuxChannelErrorType = LoginError | AuxGeneralErrorType;

export interface AuxGeneralErrorType {
    type: 'general';
    message: string;
}
