<div align="center">
    <img alt="Casual Simulation Logo" src="./.github/images/casual-sim-logo.gif" width="180"/>
    <br/>
    <br/>
    <a href="https://github.com/casual-simulation/casual-apiary-aws/issues">
        <img alt="GitHub Issues" src="https://img.shields.io/github/issues/casual-simulation/casual-apiary-aws.svg">
    </a>
    <a href="https://github.com/casual-simulation/casual-apiary-aws/blob/develop/LICENSE.txt">
        <img alt="MIT License" src="https://img.shields.io/github/license/casual-simulation/casual-apiary-aws.svg">
    </a>
    <a href="https://actions-badge.atrox.dev/casual-simulation/casual-apiary-aws/goto?ref=main">
        <img alt="Build Status" src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fcasual-simulation%2Fcasual-apiary-aws%2Fbadge%3Fref%3Dmain&style=flat" />
    </a>
    <h1>Casual Apiary AWS</h1>
    <p>
        A Serverless AWS project that can host many CasualOS instances at once.
    </p>
</div>

## Deployment

### GitHub Actions

To deploy using GitHub Actions, simply create a tag on the commit you want to deploy.

-   To deploy to the `boormanlabs` stage, create and push a tag that starts with `boormanlabs/` (like `boormanlabs/v2.0`).
-   To deploy to the `casualos-redis` stage, create and push a tag that starts with `casualos/` (like `casualos/v1.0`).
