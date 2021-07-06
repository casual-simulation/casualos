# Node.js Amazon Machine Image

This directory contains a `packer.json` file that builds a [AMI (Amazon Machine Image)](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html) which has [Node.js](https://www.nodejs.org/), and [Docker](https://www.docker.com/) pre-installed.

## Steps

1. Install [Packer](https://www.packer.io/).

On Mac:

```
$ brew install packer
```

On Windows:

```
$ choco install packer
```

On Linux, visit their [Downloads Page](https://releases.hashicorp.com/packer/1.5.6/packer_1.5.6_linux_amd64.zip).

2. Run Packer.

This assumes you installed Packer to your PATH.

```
$ cd ./.aws/ami
$ packer build packer.json
```

When finished, you will have a new AMI named `nodejs-docker-ubuntu20-{{timestamp}}` in your AWS account.
