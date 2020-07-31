import assign from 'lodash/assign';
import { AtomId } from '@casual-simulation/causal-trees';

/**
 * The list of operation types.
 */
export enum AuxOpType {
    root = 0,
    bot = 1,
    tag = 2,
    value = 3,
    delete = 4,
    insert = 5,
    certificate = 6,
    revocation = 7,
    signature = 8,
}

/**
 * Defines a union of all the possible op types.
 */
export type AuxOp =
    | BotOp
    | TagOp
    | ValueOp
    | InsertOp
    | DeleteOp
    | CertificateOp
    | SignatureOp
    | RevocationOp;

/**
 * Defines an interface for all the AUX atom values.
 */
export interface AuxOpBase {
    /**
     * The type of the operation.
     */
    type: AuxOpType;
}

/**
 * Defines an atom value that instructs the system to create a bot.
 */
export interface BotOp extends AuxOpBase {
    type: AuxOpType.bot;

    /**
     * Gets the ID of the bot.
     */
    id: string;
}

/**
 * Defines an atom value that instructs the system to create or rename a tag on a bot.
 *
 * When two tags exist with the same name
 */
export interface TagOp extends AuxOpBase {
    type: AuxOpType.tag;

    /**
     * The name of the tag.
     */
    name: string;
}

/**
 * Defines an atom value that serves as the root for changes to the value of a tag.
 */
export interface ValueOp extends AuxOpBase {
    type: AuxOpType.value;

    /**
     * The initial value.
     */
    value: any;
}

/**
 * Defines an atom value that instructs the system to insert a set of text into a tag.
 * When inserting into a ValueOp this acts as inserting text into the value part of a tag.
 * When inserting into a TagOp this acts as inserting text into the name part of a tag.
 */
export interface InsertOp extends AuxOpBase {
    type: AuxOpType.insert;

    /**
     * The index that the text should be inserted into.
     * Note that this index refers to the previous insertion operation and
     * not the full text string.
     */
    index: number;

    /**
     * The text to insert.
     */
    text: string;
}

/**
 * Defines an atom value that instructs the system to delete an item.
 * If applied onto a bot, the bot will be deleted.
 * If applied to an insert operation, the specified substring will be deleted from that insertion's text.
 */
export interface DeleteOp extends AuxOpBase {
    type: AuxOpType.delete;

    /**
     * The start index of the substring to delete.
     * If not specified the entire parent element will be tombstoned.
     */
    start?: number;

    /**
     * The end index of the substring to delete.
     */
    end?: number;
}

/**
 * Defines an atom value that instructs the system to create a certificate. (See https://en.wikipedia.org/wiki/Public_key_certificate)
 * Certificates create a chain of trust (https://en.wikipedia.org/wiki/Chain_of_trust) that can be used to validate that specific tag values have been created by a particular certificate.
 */
export interface CertificateOp extends AuxOpBase {
    type: AuxOpType.certificate;

    /**
     * The keypair that is stored in the certificate.
     * Stores both the public and private keys in the format specified in
     * the crypto package.
     * The public key is unencrypted and available for anyone to use
     * while the private key is encrypted with a password.
     */
    keypair: string;

    /**
     * The signature that is applied to this certificate.
     * Must be from the atom's cause.
     */
    signature: string;
}

/**
 * Defines an atom value that represents a signature applied to a value.
 */
export interface SignatureOp extends AuxOpBase {
    type: AuxOpType.signature;

    /**
     * The ID of the atom that created this signature.
     */
    certId: AtomId;

    /**
     * The hash of the atom that created this signature.
     */
    certHash: string;

    /**
     * The signature data that was created by the certificate.
     */
    signature: string;
}

/**
 * Defines an atom value that represents the revocation of a certificate.
 */
export interface RevocationOp extends AuxOpBase {
    type: AuxOpType.revocation;

    /**
     * The ID of the certificate that created this revocation.
     */
    certId: AtomId;

    /**
     * The hash of the certificate that created this revocation.
     */
    certHash: string;

    /**
     * The signature data that was created by the certificate.
     */
    signature: string;
}

/**
 * Creates a bot atom op.
 */
export function bot(id: string): BotOp {
    return op<BotOp>(AuxOpType.bot, {
        id,
    });
}

/**
 * Creates a tag atom op.
 */
export function tag(name: string): TagOp {
    return op<TagOp>(AuxOpType.tag, {
        name,
    });
}

/**
 * Creates a value op.
 * @param value The initial value for the tag.
 */
export function value(value: any): ValueOp {
    return op<ValueOp>(AuxOpType.value, {
        value,
    });
}

/**
 * Creates an insert op.
 * @param index The index to insert the text at.
 * @param text The text to insert.
 */
export function insert(index: number, text: string): InsertOp {
    return op<InsertOp>(AuxOpType.insert, {
        index,
        text,
    });
}

/**
 * Creates a delete op.
 * @param index The index to insert the text at.
 */
export function del(start?: number, end?: number): DeleteOp {
    return op<DeleteOp>(AuxOpType.delete, {
        start,
        end,
    });
}

/**
 * Creates a certificate op.
 * @param keypair The keypair for the certificate.
 * @param signature The signature for the certificate.
 */
export function cert(keypair: string, signature?: string): CertificateOp {
    return op<CertificateOp>(AuxOpType.certificate, {
        keypair,
        signature: signature || null,
    });
}

/**
 * Creates a signature op.
 * @param certId The ID of the cert that created the signature.
 * @param certHash The hash of the certificate.
 * @param signature The signature.
 */
export function sig(
    certId: AtomId,
    certHash: string,
    signature: string
): SignatureOp {
    return op<SignatureOp>(AuxOpType.signature, {
        certId,
        certHash,
        signature,
    });
}

/**
 * Creates a revocation op.
 * @param certId The ID of the cert that created the signature.
 * @param certHash The hash of the certificate.
 * @param signature The signature.
 */
export function revocation(
    certId: AtomId,
    certHash: string,
    signature: string
): RevocationOp {
    return op<RevocationOp>(AuxOpType.revocation, {
        certId,
        certHash,
        signature,
    });
}

export function op<T extends AuxOp>(type: T['type'], extra: Partial<T>): T {
    return <T>assign(
        {
            type: type,
        },
        extra
    );
}
