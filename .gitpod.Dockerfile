FROM gitpod/workspace-full

# Install custom tools, runtime, etc.
RUN brew install deno
RUN npm install -g lerna