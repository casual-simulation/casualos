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
export const TARGET_INPUT_PROPERTIES = ['value', 'checked'];

/**
 * Properties that should automatically be copied for specific tag types.
 * For performance, these properties are only copied if an event is sent for the element with the element as the target.
 */
export const ELEMENT_SPECIFIC_PROPERTIES: { [nodeName: string]: string[] } = {
    IMG: ['width', 'height', 'naturalWidth', 'naturalHeight', 'currentSrc'],
    VIDEO: [
        'videoWidth',
        'videoHeight',
        'duration',
        'currentSrc',
        'currentTime',
        'ended',
        'paused',
        'muted',
        'volume',
        'playbackRate',
    ],
    SECTION: ['scrollTop', 'offsetHeight'],
    CANVAS: ['height', 'width'],
};

export const ELEMENT_READ_ONLY_PROPERTIES = new Set([
    'naturalWidth',
    'naturalHeight',
    'currentSrc',
    'videoWidth',
    'videoHeight',
    'duration',
    'ended',
    'offsetHeight',
    'paused',
]);

export const TEXT_REFERENCE_PROPERTIES = ['data'];

/**
 * The properties that should be copied from the target element to the event object.
 * ONLY USED FOR FULL DOM.
 */
export const DOM_NODE_REFERENCE_PROPERTIES = [
    'namespaceURI',
    'localName',
    'style',
    'attributes',
    'className',
];

/**
 * The properties that should be copied from the target element to the event object.
 * ONLY USED FOR WHEN DOM IS NOT ENABLED.
 */
export const UNDOM_NODE_REFERENCE_PROPERTIES = [
    'namespace',
    'nodeName',
    'style',
    'attributes',
    'className',
];

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
