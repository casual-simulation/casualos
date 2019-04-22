import { SignatureAlgorithmType } from '../crypto';

/**
 * Gets information about a reserved site.
 * The goal behind this interface is to allow supporting the idea of "reserving" a site ID
 * for a causal tree and eventually allowing other sites to validate atoms sent from devices that
 * claim to represent a given site.
 */
export interface SiteInfo {
    /**
     * The ID of the site.
     */
    id: number;

    /**
     * The crypto information for the site.
     */
    crypto?: SiteInfoCrypto;
}

/**
 * Defines an interface that contains crypto information for a site.
 * Defines things like public keys and what algorithm to use.
 */
export interface SiteInfoCrypto {
    /**
     * Defines the algorithm that the site is using for signatures.
     */
    signatureAlgorithm: SignatureAlgorithmType;

    /**
     * The base 64 encoded public key that is being used.
     */
    publicKey: string;
}

/**
 * Creates a new SiteInfo object with the given ID.
 * @param id The ID.
 */
export function site(id: number, crypto?: SiteInfoCrypto): SiteInfo {
    return {
        id: id,
        crypto,
    };
}
