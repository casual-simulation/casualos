
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
            items: [{
                type: 'category',
                label: 'Tags',
                items: [
                'tags',
                'tags/info',
                'tags/behavior',
                'tags/visualization',
                'tags/dimension',
                'tags/portal-bot',
                'tags/history',
                'tags/config-bot',
                'tags/auth-bot',
                'tags/listen',
            ]},
                {
                    type: 'category',
                    label: 'Actions',
                    items: [
                        'actions/ai',
                        'actions/bot-filters',
                        'actions/bytes',
                        'actions/crypto',
                        'actions/data',
                        'actions/debuggers',
                        'actions/experimental',
                        'actions/loom',
                        'actions/math',
                        'actions/mods',
                        {
                            type: 'category',
                            label: 'OS',
                            items: [
                                'actions/os/animations',
                                'actions/os/app',
                                'actions/os/audio',
                                'actions/os/barcodes',
                                'actions/os/camera',
                                'actions/os/clipboard',
                                'actions/os/event',
                                'actions/os/files',
                                'actions/os/geolocation',
                                'actions/os/image-classification',
                                'actions/os/input',
                                'actions/os/ldraw',
                                'actions/os/maps',
                                'actions/os/media',
                                'actions/os/moderation',
                                'actions/os/portals',
                                'actions/os/spaces',
                                'actions/os/system',
                                'actions/os/records',
                                'actions/os/remotes',
                                'actions/os/rooms',
                                'actions/os/time',
                                'actions/os/xr',
                            ]
                        },
                        'actions/web',
                    ]
                },
                {
                    type: 'category',
                    label: 'Types',
                    items: [
                        'types/ai',
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
                                'types/os/maps',
                                'types/os/media',
                                'types/os/moderation',
                                'types/os/portals',
                                'types/os/spaces',
                                'types/os/system',
                                'types/os/xr',
                            ]
                        },
                        'types/loom',
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
                'abCore',
            ]
        },
    ],
  };
  