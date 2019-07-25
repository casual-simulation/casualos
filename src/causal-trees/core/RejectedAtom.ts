import { Atom, AtomOp } from './Atom';

/**
 * The possible reasons for rejecting an atom.
 */
export type RejectionReason =
    | CauseNotFound
    | SecondRootNotAllowed
    | AtomIdAlreadyExists
    | ChecksumFailed
    | SignatureFailed
    | NoPublicKey;

/**
 * Defines that the atom was not added to the weave
 * because its cause could not be found.
 */
export type CauseNotFound = 'cause_not_found';

/**
 * Defines that the atom was rejected because it is a root atom
 * and there was already a root.
 */
export type SecondRootNotAllowed = 'second_root_not_allowed';

/**
 * Defines that the atom was rejected because another atom with the same ID
 * and different checksum already exists in the weave.
 */
export type AtomIdAlreadyExists = 'atom_id_already_exists';

/**
 * Defines that the atom was rejected because its checksum failed to match its contents.
 */
export type ChecksumFailed = 'checksum_failed';

/**
 * Defines that the atom was rejected because its signature failed to match its contents
 * or public key.
 */
export type SignatureFailed = 'signature_failed';

/**
 * Defines that the atom was rejected because we don't have a public ket to verify the atom's signature with.
 */
export type NoPublicKey = 'no_public_key';

/**
 * Defines an interface for an atom that was rejected.
 */
export interface RejectedAtom<T extends AtomOp> {
    /**
     * The atom that was rejected.
     */
    atom: Atom<T>;

    /**
     * The reason why the atom was rejected.
     */
    reason: RejectionReason;
}
