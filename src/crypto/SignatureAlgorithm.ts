/**
 * The possible signature algorithm types.
 */
export type SignatureAlgorithmType = ECDSA_SHA256_NISTP256;

/**
 * Defines a signature algorithm that uses ECDSA Curve P-256 for signing and verification
 * and SHA-256 for message integrity.
 *
 * Basically this gives us 2 things:
 * 1. A digital signature. This means we can verify that only the party with the private key could have created a message.
 * 2. A hash. This means we can verify that the data hasn't changed while in transit. This helps prevent chosen ciphertext attacks because
 *    it's supposed to catch any changes to the ciphertext before signature verification occurs.
 */
export type ECDSA_SHA256_NISTP256 = 'ECDSA-SHA256-NISTP256';
