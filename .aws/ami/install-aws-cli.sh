#!/bin/bash

set -e

# Fallback to apt if apt-get fails
sudo apt-get update || sudo apt update -y
sudo apt-get upgrade -y

# Install utilities that we need
sudo apt-get install -y \
    unzip \
    curl \
    software-properties-common

curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

rm -rf awscliv2.zip
rm -rf ./aws