#!/bin/bash

set -e

# Fallback to apt if apt-get fails
sudo apt-get update || sudo apt update -y

# Install utilities that Docker needs
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common

# Add Docker stable repository
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo \
  "deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update || sudo apt update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Add the ubuntu user to the docker group
sudo usermod -a -G docker ubuntu