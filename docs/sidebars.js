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
                'variables',
                {
                    type: 'category',
                    label: 'Actions',
                    items: [
                        'actions/data',
                        'actions/bot-filters',
                        'actions/mod-actions',
                        'actions/web',
                        'actions/utility',
                        'actions/event',
                        'actions/time',
                        'actions/records'
                    ]
                },
                {
                    type: 'category',
                    label: 'Types',
                    items: [
                        'types/core',
                        'types/web',
                        'types/animation',
                        {
                            type: 'category',
                            label: 'Math',
                            items: [
                                'types/math/vectors',
                                'types/math/rotations'
                            ]
                        },
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
                        'types/permissions',
                    ]
                },
                'glossary',
                'ab-1',
                
            ]
        },
    ],
  };
  