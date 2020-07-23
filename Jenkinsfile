
pipeline {
    agent any

    environment { 
        NPM_TOKEN = credentials('jenkins-npm-token')
        RPI_HOST = credentials('jenkins-rpi-host')
        RPI_USER = credentials('jenkins-rpi-user')
        RPI_SSH_KEY_FILE = credentials('jenkins-rpi-ssh-key-file')
        DOCKER_ARM32_TAG = "casualsimulation/aux-arm32"
        DOCKER_USERNAME = credentials('jenkins-docker-username')
        DOCKER_PASSWORD = credentials('jenkins-docker-password')
        GITHUB_RELEASE_TOKEN = credentials('AUX_RELEASE_TOKEN')
        AUX_GIT_REPO_OWNER = 'casual-simulation'
        AUX_GIT_REPO_NAME = 'casualos'
    }

    tools {
        nodejs('Node10.13.0')
    }

    stages {
        stage('Setup') {
            steps {
                script {
                    env.PI_IP = sh(returnStdout: true, script: """
                    echo `ping -c1 $RPI_HOST | sed -nE \'s/^PING[^(]+\\(([^)]+)\\).*/\\1/p\'`
                    """).trim()

                    env.gitTag = "gpio"
                }

                InstallNPMPackages()
            }
        }
        stage('Create Github Release') {
            steps {
                CreateGithubRelease()
            }
        }
        stage('Build Packages') {
            steps {
                // Webpack Build
                BuildWebpack()
            }
        }
        stage('Publish Packages') {
            steps {
                PublishNPM()
            }
        }
        stage('Build/Publish Docker ARM') {
            steps {
                BuildDockerArm32()
                PublishDockerArm32()
            }
        }
    }
    post {
        success {
            CleanupDockerArm32()
        }
        failure {
            CleanupDockerArm32()
        }
    }
}


def InstallNPMPackages() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc

    echo "Installing NPM Packages..."
    npm ci
    npm run bootstrap
    """
}

def BuildWebpack() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Building..."
    NODE_ENV=production
    npm run build
    """
}

def BuildDockerArm32() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Building..."
    npm run tar
    """

    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identityFile = RPI_SSH_KEY_FILE

    sshPut remote: remote, from: './temp/output.tar.gz', into: '/home/pi'
    sshCommand remote: remote, command: "cd /home/pi; mkdir -p output; tar xzf ./output.tar.gz -C output; cd output; docker build -t ${DOCKER_ARM32_TAG}:${gitTag} ."
    
}

def PublishNPM() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
    echo "Publishing NPM Packages..."
    npx lerna publish from-package --yes
    
    echo "Updating package-lock.json..."
    # Sleep for 5 seconds to hopefully give NPM time to update the package listing
    sleep 5
    cd ./src/aux-server

    for i in {1..5}; do 
        npm install --package-lock-only && break || sleep 5;
    done
    """
}

def PublishDockerArm32() {
    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identityFile = RPI_SSH_KEY_FILE

    sshCommand remote: remote, command: "docker push ${DOCKER_ARM32_TAG}:${gitTag}"
}

def CleanupDockerArm32() {
    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identityFile = RPI_SSH_KEY_FILE

    sshCommand remote: remote, command: "docker system prune -a -f"
}
