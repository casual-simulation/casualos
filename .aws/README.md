## Creating Docker images for ARM32 & ARM64 Builds

1. Follow the instructions in `ami/README.md` to create an arm64 AMI that has docker installed.
    - Make sure to set the correct Node.js version in packer.json
2. Create an EC2 instance from the AMI that was just created.
3. SSH into the EC2 instance.
4. Clone CasualOS

```
$ git clone https://github.com/casual-simulation/casualos.git
```

5. CD to the `.aws/docker` folder.

```
$ cd casualos/.aws/docker
```

6. Build the docker image. Make sure to set the tag version to match the node version.

```
$ docker build . -t codebuild-node:16
```

7. Get the ECR Upload Password. Run this on your dev machine and not in the EC2 Instace. Remember this for later.

```
$ aws ecr get-login-password --region us-east-1
```

8. Tag and upload the new docker image to the ECR Repository.
    1. Go to Elastic Container Registry.
    2. Select the `codebuild-node` repository.
    3. Select "View Push Commands"
    4. Copy the command from step 3.
    5. Run the command on the EC2 insatnce (make sure to use the correct tag instead of the `latest` tag).
    6. Copy the command from step 4.
    7. Run the command on the EC2 instance (make sure to use the correct tag instead of the `latest` tag)
9. Go to CodeBuild and configure the `publish-casualos-docker-arm64` and `publish-casualos-docker-arm32` pipelines to use the new image.
    - Edit the "Environment" of the pipeline.
    - It should have the following properties:
        - Use Docker
        - ARM Environment
        - 16 GB of RAM
        - the image that was just published to ECR
        - Run in Priviledged mode
        - Use the project service role for image pull credentials
