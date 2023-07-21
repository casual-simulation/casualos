/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
    docs: [
        {
            type: 'category',
            label: 'The Basics',
            items: [
                'learn/pillars',
                'learn/getting-started',
                'learn/scripting',
                {
                    type: 'category',
                    label: 'Records',
                    items: [
                        'learn/records/security',
                    ]
                }
            ]
        },
        {
            type: 'category',
            label: 'Reference',
            items: [
                'tags',
                'listen-tags',
                {
                    type: 'category',
                    label: 'Actions',
                    items: [
                        'actions/audio',
                        'actions/animations',
                        'actions/app',
                        'actions/barcodes',
                        'actions/bot-filters',
                        'actions/bytes',
                        'actions/crypto',
                        'actions/data',
                        'actions/debuggers',
                        'actions/event',
                        'actions/experimental',
                        'actions/files',
                        'actions/math',
                        'actions/mods',
                        'actions/os',
                        'actions/portals',
                        'actions/records',
                        'actions/rooms',
                        'actions/time',
                        'actions/utility',
                        'actions/web',
                    ]
                },
                {
                    type: 'category',
                    label: 'Types',
                    items: [
                        'types/animation',
                        'types/core',
                        {
                            type: 'category',
                            label: 'Debuggers',
                            items: [
                                'types/debuggers/common',
                                'types/debuggers/debugger',
                                'types/debuggers/pausable-debugger',
                            ]
                        },
                        'types/experimental',
                        {
                            type: 'category',
                            label: 'Math',
                            items: [
                                'types/math/vectors',
                                'types/math/rotations'
                            ]
                        },
                        'types/os',
                        'types/permissions',
                        {
                            type: 'category',
                            label: 'Records',
                            items: [
                                'types/records/key',
                                'types/records/data',
                                'types/records/files',
                                'types/records/events',
                                'types/records/roles',
                                'types/records/policies',
                                'types/records/extra'
                            ]
                        },
                        'types/web',
                    ]
                },
                'variables',
                'glossary',
                'ab-1',
            ]
        },
    ],
  };
  