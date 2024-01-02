
export default {
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
                        'actions/ai',
                        'actions/animations',
                        'actions/app',
                        'actions/audio',
                        'actions/barcodes',
                        'actions/bot-filters',
                        'actions/bytes',
                        'actions/camera',
                        'actions/crypto',
                        'actions/data',
                        'actions/debuggers',
                        'actions/event',
                        'actions/experimental',
                        'actions/files',
                        'actions/math',
                        'actions/mods',
                        {
                            type: 'category',
                            label: 'OS',
                            items: [
                                'actions/os/animations',
                                'actions/os/audio',
                                'actions/os/barcodes',
                                'actions/os/camera',
                                'actions/os/clipboard',
                                'actions/os/event',
                                'actions/os/files',
                                'actions/os/geolocation',
                                'actions/os/image-classification',
                                'actions/os/input',
                                'actions/os/media',
                                'actions/os/moderation',
                                'actions/os/portals',
                                'actions/os/system',
                                'actions/os/remotes',
                                'actions/os/xr',
                            ]
                        },
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
                        'types/ai',
                        'types/animation',
                        'types/camera',
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
                        'types/error',
                        'types/experimental',
                        'types/geolocation',
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
                            label: 'OS',
                            items: [
                                'types/os/animations',
                                'types/os/audio',
                                'types/os/barcodes',
                                'types/os/camera',
                                'types/os/clipboard',
                                'types/os/event',
                                'types/os/files',
                                'types/os/geolocation',
                                'types/os/image-classification',
                                'types/os/input',
                                'types/os/media',
                                'types/os/moderation',
                                'types/os/portals',
                                'types/os/system',
                                'types/os/xr',
                            ]
                        },
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
  