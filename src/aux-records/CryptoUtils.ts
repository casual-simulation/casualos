import { padStart } from 'lodash';
import { randomBytes } from 'tweetnacl';

/**
 * The number of characters that random codes should contain.
 */
export const RANDOM_CODE_LENGTH = 6;

/**
 * Creates a new random numerical code.
 */
export function randomCode(): string {
    const bytes = randomBytes(4);
    const int32 = new Uint32Array(bytes.buffer);
    const str = padStart(
        int32[0].toString().substring(0, RANDOM_CODE_LENGTH),
        RANDOM_CODE_LENGTH,
        '0'
    );
    return str;
}
