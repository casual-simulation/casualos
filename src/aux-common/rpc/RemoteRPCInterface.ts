import type { Procedures, RemoteProcedures } from './GenericRPCInterface';

export function remoteProcedures<T extends Procedures>(): RemoteProcedures<T> {
    return null;
}
