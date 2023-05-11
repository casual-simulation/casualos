<div align="center">
    <img alt="Casual Simulation Logo" src="./.github/images/casual-sim-logo.gif" width="180"/>
    <br/>
    <br/>
    <a href="https://github.com/casual-simulation/casualos/issues">
        <img alt="GitHub Issues" src="https://img.shields.io/github/issues/casual-simulation/casualos.svg">
    </a>
    <a href="https://github.com/casual-simulation/casualos/blob/develop/LICENSE.txt">
        <img alt="MIT License" src="https://img.shields.io/github/license/casual-simulation/casualos.svg">
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
