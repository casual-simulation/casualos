# CasualOS Infra

A set of [Pulumi](https://www.pulumi.com/) components that make it easy to deploy CasualOS in a variety of manners.

### Features

-   Serverless deployments of CasualOS.

### Requirements

-   [CasualOS CLI](https://www.npmjs.com/package/casualos)
-   [Pulumi](https://www.pulumi.com/docs/install/)

### Getting Started

#### 1. First, create a new infra project

```bash
$ casualos infra new your-project-name
```

This will prompt you to create a new GitHub repo and configure Pulumi to store its state in the cloned repo.

When you make updates to the stack, you should make sure to save and push your changes. You can do this by opening the repo in Git and commiting and pushing, or you can do it by using `casualos infra save your-project-name`.
