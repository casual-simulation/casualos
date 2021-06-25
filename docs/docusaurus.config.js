module.exports = {
  title: 'CasualOS',
  tagline: 'Problem Solving For People',
  url: 'https://docs.casualos.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'casual-simulation', // Usually your GitHub org/user name.
  projectName: 'casual-simulation.github.io', // Usually your repo name.
  themeConfig: {
    prism: {
      theme: require('prism-react-renderer/themes/vsDark')
    },
    algolia: {
      apiKey: '0dbc937f9ffe92dff4782c5c40f15992',
      indexName: 'casualos',
      algoliaOptions: {}
    },
    navbar: {
      title: 'CasualOS',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.png',
      },
      items: [
        { to: 'docs/tags', label: 'Docs', position: 'left' },
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
          title: 'Docs',
          items: [
            {
              label: 'Docs',
              to: 'docs/tags',
            },
          ],
        },
        {
          title: 'Social',
          items: [
            {
              label: 'Chat',
              to: 'https://spectrum.chat/casual-simulation?tab=posts',
            },
          ],
        },
      ],
      logo: {
        alt: 'Casual Simulation Logo',
        src: '/img/logo.png',
      },
      copyright: `Copyright © ${new Date().getFullYear()} Casual Simulation Built with Docusaurus.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/casual-simulation/casualos/tree/develop/docs',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
