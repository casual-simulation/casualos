FROM gitpod/workspace-full

# Install custom tools, runtime, etc.
RUN brew install deno
RUN brew install awscli
RUN brew tap aws/tap
RUN brew install aws-sam-cli
RUN npm install -g lerna