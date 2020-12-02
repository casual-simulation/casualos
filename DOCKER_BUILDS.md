# Docker Builds

This document contains instructions on how to produce docker images for the project.

## Setting up a Raspberry PI

1. Get a clean Raspbian installation on your Raspberry PI
2. Install docker ([source](https://medium.freecodecamp.org/the-easy-way-to-set-up-docker-on-a-raspberry-pi-7d24ced073ef))
    1. `curl -fsSL get.docker.com -o get-docker.sh && sh get-docker.sh`
    2. Setup to run without sudo:
        1. `sudo groupadd docker`
        2. `sudo gpasswd -a $USER docker`
        3. Logout and log back in.
3. Enable the Docker Service
    - `sudo systemctl enable docker`
4. Start the Docker Service
    - `sudo systemctl start docker`
5. Sign into Docker
    - `docker login -u <username> -p <password>`

## Building an arm32v7 image on a Raspberry PI

### Option 1 (recommended)

Build the project on the dev/ci machine and build the image on the Raspberry PI

**Prerequisites:**

1. Follow the steps above to setup a Raspberry PI with docker.

**Steps:**

1. On your Dev Machine
    1. Run a build and package it into a `.tar.gz` file.
        - `npm run build:tar:docker`
    2. Rsync the tar file into the Raspberry PI
        - `rsync --progress ./temp/output.tar.gz pi@{your_pi_ip_address}:/home/pi`
1. On the Raspberry PI
    1. Unpack the `.tar.gz`
        - `mkdir output`
        - `tar xzf ./output.tar.gz -C output`
    2. Build the docker image
        - `docker build -t casual-simulation/aux-arm32 -f Dockerfile.arm32 output`

### Option 2

Build the entire project on the Raspberry PI

**Prerequisites:**

1. Follow the steps above to setup a Raspberry PI with docker.
2. Make sure git is installed
    - `sudo apt-get install git`
3. Make sure NVM is installed
    - `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash`
    - Make sure to run the commands they indicate so bash knows where to find nvm.
4. Make sure Node.js 10.13.0 or later is installed
    - `nvm install node`
5. Make sure lerna is installed
    - `npm install -g lerna`
6. Clone the aux repository
    - `git clone https://github.com/casual-simulation/casualos.git`
7. Setup SSH
    1. On Server:
        1. `ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -m PEM`
        2. Name the key
        3. Give Passphrase or Skip
        4. Confirm Passphrase or Skip
        5. `cat /path/to/your/key.pub`
        6. Copy the key
    2. On Agent (Pi):
        1. `sudo nano ~/.ssh/authorized_keys`
        2. Paste in your public key

**Steps:**

1. Pull the latest `master`
    - `git pull`
2. Run a build
    - `npm run bootstrap && npm run build:docker:arm32`
