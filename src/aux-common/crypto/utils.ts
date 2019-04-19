import { fromByteArray, toByteArray } from 'base64-js';

/**
 * The header that gets added to private keys formated as a PEM file.
 */
export const PEM_PRIVATE_KEY_HEADER: string = '-----BEGIN PRIVATE KEY-----';

/**
 * The footer that gets added to private keys formated as a PEM file.
 */
export const PEM_PRIVATE_KEY_FOOTER: string = '-----END PRIVATE KEY-----';

/**
 * The header that gets added to public keys formated as a PEM file.
 */
export const PEM_PUBLIC_KEY_HEADER: string = '-----BEGIN PUBLIC KEY-----';

/**
 * The footer that gets added to public keys formated as a PEM file.
 */
export const PEM_PUBLIC_KEY_FOOTER: string = '-----END PUBLIC KEY-----';

/**
 * Formats the given buffer as a PEM file for public keys.
 * @param key The buffer that should be stored in the PEM file.
 */
export function formatPublicPEMKey(key: ArrayBuffer): string {
    return formatPEM(key, PEM_PUBLIC_KEY_HEADER, PEM_PUBLIC_KEY_FOOTER);
}

/**
 * Formats the given buffer as a PEM file for private keys.
 * @param key The buffer that should be stored in the PEM file.
 */
export function formatPrivatePEMKey(key: ArrayBuffer) {
    return formatPEM(key, PEM_PRIVATE_KEY_HEADER, PEM_PRIVATE_KEY_FOOTER);
}

/**
 * Formats the given buffer into PEM format.
 * @param buffer The buffer to format.
 * @param header The header to use.
 * @param footer The footer to use.
 */
export function formatPEM(
    buffer: ArrayBuffer,
    header: string,
    footer: string
): string {
    const bytes = new Uint8Array(buffer);
    const base64 = fromByteArray(bytes);
    const pem = `${header}\n${base64}\n${footer}`;
    return pem;
}

/**
 * Parses the given private key PEM file into a buffer that contains just the key.
 * @param pem The PEM file that represents the private key.
 */
export function parsePrivatePEMKey(pem: string): ArrayBuffer {
    return parsePEM(pem, PEM_PRIVATE_KEY_HEADER, PEM_PRIVATE_KEY_FOOTER);
}

/**
 * Parses the given public key PEM file into a buffer that contains just the key.
 * @param pem The PEM file that represents the public key.
 */
export function parsePublicPEMKey(pem: string): ArrayBuffer {
    return parsePEM(pem, PEM_PUBLIC_KEY_HEADER, PEM_PUBLIC_KEY_FOOTER);
}

/**
 * Parses the given PEM file using the given header and footer strings.
 * Returns an ArrayBuffer containing the bytes that were formatted into the PEM file.
 *
 * Note that this should probably not be used for PEM files other than the ones produced by
 * formatPEM(). This is because PEM files can contain a lot of extra data that this implementation
 * does not expect. For example, some PEM files can contain multiple keys and probably allow more whitespace.
 *
 * @param pem The PEM file to parse.
 * @param header The header that we're expecting the file to have.
 * @param footer The footer that we're expecting the file to have.
 */
export function parsePEM(
    pem: string,
    header: string,
    footer: string
): ArrayBuffer {
    pem = pem.trim();

    // Make sure we remove the newlines
    let contents = pem.substring(
        header.length + 1,
        pem.length - (footer.length + 1)
    );
    contents = contents.replace('\n', '');
    const buffer = toByteArray(contents);
    return buffer.buffer;
}
