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
export async function writeTextToClipboard(text: string) {
    if (!navigator.clipboard) {
        throw new Error('[Clipboard] Not supported.');
    }
    try {
        await navigator.clipboard.writeText(text);
        console.log('[Clipboard] Copied to clipboard!');
    } catch (ex) {
        console.error('[Clipboard] Could not write to clipboard: ', ex);
        throw ex;
    }
}

export async function readTextFromClipboard(): Promise<string> {
    if (!navigator.clipboard) {
        throw new Error('[Clipboard] Not supported.');
    }
    try {
        const text = await navigator.clipboard.readText();
        console.log('[Clipboard] Read Clipboard!');
        return text;
    } catch (ex) {
        console.error('[Clipboard] Could not read from clipboard: ', ex);
        throw ex;
    }
}
