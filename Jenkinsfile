
pipeline {
    agent any

    environment { 
        NPM_TOKEN = credentials('jenkins-npm-token')
        RPI_HOST = credentials('jenkins-rpi-host')
        RPI_USER = credentials('jenkins-rpi-user')
        RPI_SSH_KEY_FILE = credentials('jenkins-rpi-ssh-key-file')
        DOCKER_ARM32_TAG = "casualsimulation/aux/arm32"
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

                    env.gitTag = sh(returnStdout: true, script: """
                        echo `git describe --abbrev=0 --tags`
                    """).trim()
                }

                // InstallNPMPackages()

                BuildDockerArm32()
            }
        }
        // stage('Test') {
        //     steps {
        //         // BuildDocker()
        //         Tests()
        //     }
        // }
        // stage('Build Packages') {
        //     steps {
        //         // Webpack Build
        //         BuildWebpack()
        //     }
        // }
        // stage('Publish Packages') {
        //     steps {
        //         PublishNPM()
        //     }
        // }
        // stage('Build Docker') {
        //     steps {
        //         BuildDocker()
        //         BuildDockerArm32()
        //     }
        // }
        // stage('Publish Docker') {
        //     steps {
        //         PublishDocker()
        //         PublishDockerArm32()
        //     }
        // }
    }
    post {
        success {
            NotifySuccessful()
            junit 'junit.xml'
        }
        failure {
            NotifyFailed()
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

def Tests() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Running tests..."
    npm run test:ci
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

def BuildDocker() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Building..."

    /usr/local/bin/docker build -t "casualsimulation/aux:${gitTag}" -t "casualsimulation/aux:latest" .
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
    remote.identity = RPI_SSH_KEY_FILE

    sshPut remote: remote, from: './temp/output.tar.gz', into: '/home/pi'
    sshCommand remote: remote, command: "cd /home/pi; mkdir output; tar xzf ./output.tar.gz -C output; docker build -t ${DOCKER_ARM32_TAG}:${gitTag} -t ${DOCKER_ARM32_TAG}:latest -f Dockerfile.arm32 output"
    
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
    npm install --package-lock-only
    """
}

def PublishDocker() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    /usr/local/bin/docker push casualsimulation/aux:${gitTag}
    """
}

def PublishDockerArm32() {
    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identity = RPI_SSH_KEY_FILE

    sshCommand remote: remote, command: "docker push ${DOCKER_ARM32_TAG}:${gitTag}"
}


// Slack message notification functions
def NotifyStarted() {
    try {
        echo "JFDebug: Sending Start Message"
        slackSend(channel: '#yeti-builds', color: '#FFDF17', message: "STARTED: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}

def NotifySuccessful() {
    try {
        echo "JFDebug: Sending Successful Message"
        slackSend(channel: '#yeti-builds', color: '#0FAD03', message: "SUCCESSFUL: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}

def NotifyFailed() {
    try {
        echo "JFDebug: Sending Message Failed"
        slackSend(channel: '#yeti-builds', color: '#CD2900', message: "FAILED: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}