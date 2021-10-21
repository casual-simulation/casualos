FROM gitpod/workspace-full

# Install custom tools, runtime, etc.
RUN brew install deno

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -s -o "/tmp/awscliv2.zip" \
    && unzip -qq /tmp/awscliv2.zip -d /tmp \
    && sudo /tmp/aws/install -i /usr/local/aws-cli -b /usr/local/bin

# Install AWS SAM CLI
RUN curl "https://github.com/aws/aws-sam-cli/releases/download/v1.33.0/aws-sam-cli-linux-x86_64.zip" -Ls -o "/tmp/samcli.zip" \
    && unzip -qq /tmp/samcli.zip -d /tmp/sam \
    && sudo /tmp/sam/install

RUN npm install -g lerna