import {
    FileCalculationContext,
    isContext,
    getContextVisualizeMode,
    getContextPosition,
    getContextScale,
    getContextSize,
    AuxObject,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import { storedTree } from '@casual-simulation/causal-trees';
import { Simulation } from '@casual-simulation/aux-vm';
import { flatMap } from 'lodash';
import {
    hexesInRadius,
    realPosToGridPos,
    Axial,
    posToKey,
    hexRing,
} from './scene/hex';
import { Vector2 } from 'three';

/**
 * Pads the given string with zeros up to the given length.
 */
export function padZero(str: string, len: number = 2) {
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

/**
 * Converts a number into a 2-character hex number.
 * @param byte The byte to convert.
 */
export function byteToHex(byte: number) {
    // Turns a number (0-255) into a 2-character hex number (00-ff)
    return ('0' + byte.toString(16)).slice(-2);
}

/**
 * Copies the given text to the user's clipboard by creating a textarea, selecting it, and then
 * running the 'copy' command. Likely will only work as a response to a user click or key event.
 * @param text The text to copy to the user's clipboard.
 */
export function copyToClipboard(text: string) {
    const el = document.createElement('textarea'); // Create a <textarea> element
    el.value = text; // Set its value to the string that you want copied
    el.setAttribute('readonly', ''); // Make it readonly to be tamper-proof
    el.style.position = 'absolute';
    el.style.left = '-9999px'; // Move outside the screen to make it invisible
    document.body.appendChild(el); // Append the <textarea> element to the HTML document
    const selected =
        document.getSelection().rangeCount > 0 // Check if there is any content selected previously
            ? document.getSelection().getRangeAt(0) // Store selection if found
            : false; // Mark as false to know no selection existed before
    el.select(); // Select the <textarea> content
    document.execCommand('copy'); // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el); // Remove the <textarea> element
    if (selected) {
        // If a selection existed before copying
        document.getSelection().removeAllRanges(); // Unselect everything on the HTML document
        document.getSelection().addRange(selected); // Restore the original selection
    }
}

export function getOptionalValue(obj: any, defaultValue: any): any {
    return obj !== undefined && obj !== null ? obj : defaultValue;
}

export function isMac(): boolean {
    return /(Mac)/i.test(navigator.platform);
}

export function nextAvailableWorkspacePosition(calc: FileCalculationContext) {
    const visibleWorkspacePositions = flatMap(
        calc.objects.filter(
            f =>
                isContext(calc, f) &&
                getContextVisualizeMode(calc, f) === 'surface'
        ),
        f => {
            const position = getContextPosition(calc, f);
            const scale = getContextScale(calc, f);
            const positions = hexesInRadius(getContextSize(calc, f));
            const centerPosition = realPosToGridPos(
                new Vector2(position.x, position.y),
                scale
            );

            return positions.map(hex => {
                return new Axial(
                    hex.q + centerPosition.q,
                    hex.r + centerPosition.r
                );
            });
        }
    );

    const mappedPositions = new Map<string, Axial>();

    for (let pos of visibleWorkspacePositions) {
        mappedPositions.set(posToKey(pos), pos);
    }

    let radius = 1;
    let nextPosition: Axial = null;
    while (!nextPosition) {
        const positions = hexRing(radius);
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!mappedPositions.has(posToKey(pos))) {
                nextPosition = pos;
                break;
            }
        }

        radius += 1;
    }

    return nextPosition;
}

/**
 * Copies the given list of files as an AUX to the user's clipboard.
 * @param files The files to copy.
 */
export async function copyFilesFromSimulation(
    simulation: Simulation,
    files: AuxObject[]
) {
    // TODO: Fix
    // const atoms = files.map(f => f.metadata.ref);
    // const weave = simulation.aux.tree.weave.subweave(...atoms);
    // const stored = storedTree(
    //     simulation.aux.tree.site,
    //     simulation.aux.tree.knownSites,
    //     weave.atoms
    // );
    // let tree = new AuxCausalTree(stored);
    // await tree.import(stored);
    // const json = JSON.stringify(tree.export());
    // copyToClipboard(json);
}
