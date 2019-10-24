/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = {
  title: 'Casual Simulation',
  tagline: 'Problem solving for people',
  url: 'https://docs.casualsimulation.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'casual-simulation', // Usually your GitHub org/user name.
  projectName: 'casual-simulation.github.io', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'Casual Simulation',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.png',
      },
      links: [
        {to: 'docs/tags', label: 'Docs', position: 'left'},
        {
          href: 'https://github.com/casual-simulation/aux',
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
              label: 'Blog',
              to: 'blog',
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
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
