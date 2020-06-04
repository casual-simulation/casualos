module.exports = {
  title: 'Casual Simulation',
  tagline: 'Problem Solving For People',
  url: 'https://docs.casualsimulation.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'casual-simulation', // Usually your GitHub org/user name.
  projectName: 'casual-simulation.github.io', // Usually your repo name.
  themeConfig: {
    prism: {
      theme: require('prism-react-renderer/themes/vsDark')
    },
    algolia: {
      apiKey: 'cb27142d55e709001f05b814fd2b51be',
      indexName: 'casualsimulation',
      algoliaOptions: {}
    },
    navbar: {
      title: 'Casual Simulation',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.png',
      },
      links: [
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
        src: '/img/logo.gif',
      },
      copyright: `Copyright © ${new Date().getFullYear()} Casual Simulation Built with Docusaurus.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          // It is recommended to set document id as docs home page (`docs/` path).
          homePageId: 'tags',
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
