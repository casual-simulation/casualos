import path from 'path';
import { themes } from 'prism-react-renderer';

export default {
  title: 'CasualOS',
  tagline: 'Problem Solving For People',
  url: 'https://docs.casualos.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'casual-simulation', // Usually your GitHub org/user name.
  projectName: 'casual-simulation.github.io', // Usually your repo name.
  deploymentBranch: 'master',
  themeConfig: {
    prism: {
      theme: themes.vsDark,
      darkTheme: themes.vsDark,
    },
    algolia: {
      appId: 'TNXB2QF2YB',
      apiKey: 'c2c41992d7b847d4eea7dca38f8bfd17',
      indexName: 'casualos',
      algoliaOptions: {}
    },
    navbar: {
      title: 'CasualOS',
      logo: {
        alt: 'CasualOS Logo',
        src: 'img/logo.png',
      },
      items: [
        {
            type: 'docsVersionDropdown',
            position: 'left',
            dropdownItemsAfter: [],
            dropdownActiveClassDisabled: true,
        },
        {
          href: 'https://github.com/casual-simulation/casualos',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
            title: 'Learn',
            items: [
                {
                    label: 'Introduction',
                    to: '/'
                },
                {
                    label: 'Getting Started',
                    to: 'learn/getting-started'
                }
            ]
        },
        {
          title: 'Docs',
          items: [
            {
              label: 'Tags',
              to: 'tags',
            },
            {
                label: 'Actions',
                to: 'actions',
            },
            {
                label: 'Listen Tags',
                to: 'listen-tags',
            },
            {
                label: 'Variables',
                to: 'variables',
            },
            {
                label: 'Glossary',
                to: 'glossary',
            },
          ],
        },
        {
            title: 'More',
            items: [
                {
                    label: 'Company',
                    to: 'https://casualsimulation.org/'
                },
                {
                    label: 'Support CasualOS',
                    to: 'https://opencollective.com/casualos'
                },
                {
                    label: 'GitHub',
                    to: 'https://github.com/casual-simulation/casualos'
                },
                {
                    label: 'Changelog',
                    to: 'https://github.com/casual-simulation/casualos/releases'
                },
            ]
        },
        {
            title: 'Legal',
            items: [
                {
                    label: 'Terms of Service',
                    to: 'https://publicos.link/terms'
                },
                {
                    label: 'Acceptable Use Policy',
                    to: 'https://publicos.link/acceptable-use-policy'
                },
                {
                    label: 'Privacy Policy',
                    to: 'https://publicos.link/privacy-policy'
                },
            ]
        }
      ],
      logo: {
        alt: 'CasualOS Logo',
        src: '/img/logo.png',
      },
      copyright: `Copyright © ${new Date().getFullYear()} Casual Simulation`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/', // Serve the docs at the site's root
          sidebarPath: path.resolve('./sidebars.js'),
          tagsBasePath: 'labels',
          // Please change this to your repo.
          editUrl:
            'https://github.com/casual-simulation/casualos/tree/develop/docs',

          lastVersion: 'current',
          versions: {
            'current': {
                label: 'Current',
             },
             '3.1.36': {
                label: 'v3.1.36',
                path: '3.1.36'
             }
          },
        },
        blog: false, // Disable the blog plugin
        theme: {
          customCss: path.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  plugins: [
      [
        '@docusaurus/plugin-client-redirects',
        {
            redirects: [
                {
                  to: '/tags/listen', // string
                  from: '/docs/listen-tags/tags', // string | string[]
                },
                {
                    to: '/variables', // string
                    from: '/docs/listen-tags/variables', // string | string[]
                },
                {
                    to: '/tags', // string
                    from: '/docs/tags', // string | string[]
                },
                {
                    to: '/variables', // string
                    from: '/docs/variables', // string | string[]
                },
                {
                    to: '/tags/listen', // string
                    from: ['/docs/listen-tags', '/listen-tags'], // string | string[]
                },
                {
                    to: '/glossary', // string
                    from: '/docs/glossary', // string | string[]
                },
                {
                    to: '/3.1.36/actions', // string
                    from: '/docs/actions', // string | string[]
                },
                {
                    to: '/learn/getting-started', // string
                    from: '/docs/learn/getting-started', // string | string[]
                },
                {
                    to: '/', // string
                    from: '/docs/learn/pillars', // string | string[]
                },
                {
                    to: '/learn/scripting', // string
                    from: '/docs/learn/scripting', // string | string[]
                },
                {
                    to: '/actions/data', // string
                    from: '/actions', // string | string[]
                },
            ],
        },
      ],
      './plugins/simple-analytics'
  ]
};
