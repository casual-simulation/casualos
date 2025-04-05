/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Bot, StoredAuxVersion2 } from '@casual-simulation/aux-common';
import { applyUpdatesToInst } from '@casual-simulation/aux-common';
import type { Simulation } from '@casual-simulation/aux-vm';
import { remote } from '@casual-simulation/aux-common';

/**
 * Pads the given string with zeros up to the given length.
 */
export function padZero(str: string, len: number = 2) {
    let zeros = new Array(len).join('0');
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

/**
 * Copies the given list of bots as an AUX to the user's clipboard.
 * @param bots The bots to copy.
 */
export async function copyBotsFromSimulation(
    simulation: Simulation,
    bots: Bot[]
) {
    const stored = await simulation.exportBots(bots.map((f) => f.id));
    const json = JSON.stringify(stored);
    copyToClipboard(json);
}

export function isValidURL(str: string) {
    try {
        // Test the URL by making one.
        const test = new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Navigates the user to the given URL via a dynamically created <a> tag.
 * @param url The URL to navigate to.
 * @param target The target attribute to use.
 * @param rel The rel attribute to use.
 */
export function navigateToUrl(url: string, target?: string, rel?: string) {
    const a = document.createElement('a');
    a.href = url;
    if (target) {
        a.target = target;
    }
    if (rel) {
        a.rel = rel;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Gets whether WebXR is supported.
 */
export function supportsXR(): boolean {
    const nav: any = navigator;
    return !!nav.xr;
}

export function wrapHtmlWithSandboxContentSecurityPolicy(html: string): string {
    return `<html><head>
            <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'; script-src 'none'; style-src * 'unsafe-inline'">
            <style>* { box-sizing: border-box; } html { font-family: Roboto, apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; } html, body { width: 100%;height: 100%; margin: 0; position: absolute; } body > iframe, body > video { width: 100%; height: 100%; }</style></head><body>${html}</body></html>`;
}

let loadedScripts = new Set();

/**
 * Loads the given script. Returns a promisve that resolves when the script has been loaded.
 * @param src The URL to load.
 */
export function loadScript(src: string): Promise<void> {
    if (loadedScripts.has(src)) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;

        el.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        el.onerror = () => {
            reject();
        };

        document.body.appendChild(el);
    });
}

export async function addStoredAuxV2ToSimulation(
    sim: Simulation,
    stored: StoredAuxVersion2
) {
    await sim.helper.transaction(
        remote(
            applyUpdatesToInst(stored.updates),
            undefined,
            undefined,
            undefined
        )
    );
}
