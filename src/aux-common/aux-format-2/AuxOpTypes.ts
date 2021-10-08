import { assign } from 'lodash';
import { AtomId, Atom, atom } from '@casual-simulation/causal-trees';
import { sign, verify, keypair, getHash } from '@casual-simulation/crypto';
import stringify from '@casual-simulation/fast-json-stable-stringify';

/**
 * The list of operation types.
 */
export enum AuxOpType {
    Root = 0,
    Bot = 1,
    Tag = 2,
    Value = 3,
    Delete = 4,
    Insert = 5,
    Certificate = 6,
    Revocation = 7,
    Signature = 8,
    TagMask = 9,
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
    | RevocationOp
    | TagMaskOp;

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
    type: AuxOpType.Bot;

    /**
     * Gets the ID of the bot.
     */
    id: string;
}

/**
 * Defines an atom value that instructs the system to create a tag on a bot.
 */
export interface TagOp extends AuxOpBase {
    type: AuxOpType.Tag;

    /**
     * The name of the tag.
     */
    name: string;
}

/**
 * Defines an atom value that serves as the root for changes to the value of a tag.
 */
export interface ValueOp extends AuxOpBase {
    type: AuxOpType.Value;

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
    type: AuxOpType.Insert;

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
    type: AuxOpType.Delete;

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
    type: AuxOpType.Certificate;

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
    type: AuxOpType.Signature;

    /**
     * The ID of the atom that created this signature was created for.
     */
    valueId: AtomId;

    /**
     * The hash of the atom that this signature was created for.
     */
    valueHash: string;

    /**
     * The signature data that was created by the certificate.
     */
    signature: string;
}

/**
 * Defines an atom value that represents the revocation of a certificate.
 */
export interface RevocationOp extends AuxOpBase {
    type: AuxOpType.Revocation;

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
 * Defines an atom value that instructs the system to create a tag mask.
 */
export interface TagMaskOp extends AuxOpBase {
    type: AuxOpType.TagMask;

    /**
     * The ID of the bot that this tag mask applies to.
     */
    botId: string;

    /**
     * The name of the tag.
     */
    name: string;
}

/**
 * Creates a bot atom op.
 */
export function bot(id: string): BotOp {
    return op<BotOp>(AuxOpType.Bot, {
        id,
    });
}

/**
 * Creates a tag atom op.
 */
export function tag(name: string): TagOp {
    return op<TagOp>(AuxOpType.Tag, {
        name,
    });
}

/**
 * Creates a value op.
 * @param value The initial value for the tag.
 */
export function value(value: any): ValueOp {
    return op<ValueOp>(AuxOpType.Value, {
        value,
    });
}

/**
 * Creates an insert op.
 * @param index The index to insert the text at.
 * @param text The text to insert.
 */
export function insertOp(index: number, text: string): InsertOp {
    return op<InsertOp>(AuxOpType.Insert, {
        index,
        text,
    });
}

/**
 * Creates a delete op.
 * @param index The index to insert the text at.
 */
export function deleteOp(start?: number, end?: number): DeleteOp {
    return op<DeleteOp>(AuxOpType.Delete, {
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
    return op<CertificateOp>(AuxOpType.Certificate, {
        keypair,
        signature: signature || null,
    });
}

/**
 * Creates a signature op.
 * @param valueId The ID of the value that signature was created for.
 * @param valueHash The hash of the value that the signature was created for.
 * @param signature The signature.
 */
export function sig(
    valueId: AtomId,
    valueHash: string,
    signature: string
): SignatureOp {
    return op<SignatureOp>(AuxOpType.Signature, {
        valueId,
        valueHash,
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
    return op<RevocationOp>(AuxOpType.Revocation, {
        certId,
        certHash,
        signature,
    });
}

/**
 * Creates a tag mask op.
 * @param botId The ID of the bot that the tag mask is for.
 * @param name The name of the tag.
 */
export function tagMask(botId: string, name: string): TagMaskOp {
    return op<TagMaskOp>(AuxOpType.TagMask, {
        botId,
        name,
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

/**
 * Creates a certificate that is self signed.
 * @param password The password used to encrypt the keypair.
 */
export function selfSignedCert(password: string): CertificateOp {
    const keys = keypair(password);
    return signedCert(null, password, keys);
}

/**
 * Calculates a signature for the given keypair that can be used for a certificate.
 * Returns a signature that can validate that a certificate was signed by another cert.
 * @param signingCert The certificate that is signing the keypair. If null then the certKeypair will be signed with itself.
 * @param signingPassword The password that is needed to decrypt the keypair in the signing certificate.
 * @param certKeypair The keypair that should be signed.
 */
export function signedCert(
    signingCert: Atom<CertificateOp> | null,
    signingPassword: string,
    certKeypair: string
): CertificateOp {
    const bytes = certSigningBytes(signingCert, certKeypair);
    const sig = sign(
        signingCert ? signingCert.value.keypair : certKeypair,
        signingPassword,
        bytes
    );
    if (!sig) {
        throw new Error('Unable to sign the certificate.');
    }
    return cert(certKeypair, sig);
}

/**
 * Validates that the given signed cert was signed with the given signing cert.
 * @param signingCert The cert that created the signature.
 * @param signedCert The cert that was signed.
 */
export function validateCertSignature(
    signingCert: Atom<CertificateOp> | null,
    signedCert: Atom<CertificateOp>
): boolean {
    const bytes = certSigningBytes(signingCert, signedCert.value.keypair);
    try {
        return verify(
            signingCert ? signingCert.value.keypair : signedCert.value.keypair,
            signedCert.value.signature,
            bytes
        );
    } catch (err) {
        return false;
    }
}

/**
 * Creates a signature for the given value atom.
 * @param signingCert The certificate that is signing the value.
 * @param signingPassword The password used to decrypt the private key.
 * @param value The value to sign.
 */
export function signedValue(
    signingCert: Atom<CertificateOp>,
    signingPassword: string,
    value: Atom<ValueOp>
): SignatureOp {
    const bytes = valueSigningBytes(signingCert, value);
    const signature = sign(signingCert.value.keypair, signingPassword, bytes);
    if (!signature) {
        throw new Error('Unable to sign the value.');
    }
    return sig(value.id, value.hash, signature);
}

/**
 * Validates that the given signature was signed with the given certificate.
 * @param signingCert
 * @param signature
 */
export function validateSignedValue(
    signingCert: Atom<CertificateOp>,
    signature: Atom<SignatureOp>,
    value: Atom<ValueOp>
): boolean {
    try {
        const bytes = valueSigningBytes(signingCert, value);
        return verify(
            signingCert.value.keypair,
            signature.value.signature,
            bytes
        );
    } catch (err) {
        return false;
    }
}

/**
 * Creates a revocation for the given certificate or signature atom.
 * @param signingCert The certificate that is signing the value.
 * @param signingPassword The password used to decrypt the private key.
 * @param atom The value to revoke.
 */
export function signedRevocation(
    signingCert: Atom<CertificateOp>,
    signingPassword: string,
    atom: Atom<CertificateOp> | Atom<SignatureOp>
): RevocationOp {
    const bytes = revocationSigningBytes(signingCert, atom);
    const signature = sign(signingCert.value.keypair, signingPassword, bytes);
    if (!signature) {
        throw new Error('Unable to sign the value.');
    }
    return revocation(signingCert.id, signingCert.hash, signature);
}

/**
 * Validates that the given revocation was signed with the given certificate.
 * @param signingCert
 * @param revocation
 */
export function validateRevocation(
    signingCert: Atom<CertificateOp>,
    revocation: Atom<RevocationOp>,
    atom: Atom<CertificateOp> | Atom<SignatureOp>
): boolean {
    try {
        const bytes = revocationSigningBytes(signingCert, atom);
        return verify(
            signingCert.value.keypair,
            revocation.value.signature,
            bytes
        );
    } catch (err) {
        return false;
    }
}

function certSigningBytes(
    signingCert: Atom<CertificateOp> | null,
    certKeypair: string
): Uint8Array {
    if (!signingCert) {
        return signingBytes([certKeypair]);
    } else {
        return signingBytes([signingCert.hash, certKeypair]);
    }
}

function valueSigningBytes(
    signingCert: Atom<CertificateOp>,
    value: Atom<ValueOp>
): Uint8Array {
    return signingBytes([signingCert.hash, value.hash]);
}

function revocationSigningBytes(
    signingCert: Atom<CertificateOp>,
    value: Atom<CertificateOp> | Atom<SignatureOp>
): Uint8Array {
    return signingBytes([signingCert.hash, value.hash]);
}

function signingBytes(data: any): Uint8Array {
    const json = stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(json);
}

/**
 * Gets the hash for the given tag and value.
 * @param botId The ID of the bot.
 * @param tag The tag.
 * @param value The value.
 */
export function tagValueHash(botId: string, tag: string, value: any): string {
    return getHash([botId, tag, value]);
}
