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

export const TEXT_REFERENCE_PROPERTIES = ['data'];
export const NODE_REFERENCE_PROPERTIES = [
    'namespace',
    'nodeName',
    'style',
    'attributes',
    'className',
];

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
