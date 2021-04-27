
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

    parameters {
        string(name: 'MAIN_BRANCH', defaultValue: 'master', description: 'The main branch that should be used to determine if the current build is the latest production release.')
    }

    stages {
        stage('Setup') {
            steps {
                echo "Building branch: ${env.GIT_BRANCH}"
                echo "Main Release: ${env.GIT_BRANCH.endsWith(params.MAIN_BRANCH)}"

                NotifyStarted()
                script {
                    env.PI_IP = sh(returnStdout: true, script: """
                    echo `ping -c1 $RPI_HOST | sed -nE \'s/^PING[^(]+\\(([^)]+)\\).*/\\1/p\'`
                    """).trim()

                    env.gitTag = sh(returnStdout: true, script: """
                        echo `git describe --abbrev=0 --tags`
                    """).trim()
                }

                InstallNPMPackages()
            }
        }
        stage('Create Github Release') {
            steps {
                CreateGithubRelease()
            }
        }
        stage('Test') {
            steps {
                Tests()
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
        stage('Publish Docs') {
            steps {
                PublishDocs()
            }
        }
        stage('Build/Publish Docker x64') {
            steps {
                BuildDocker()
                PublishDocker()
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
            NotifySuccessful()
            junit 'junit.xml'

            Cleanup()
        }
        failure {
            NotifyFailed()
            Cleanup()
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

    /usr/local/bin/docker build -t "casualsimulation/aux:${gitTag}" -t "casualsimulation/aux:latest" -t "casualsimulation/aux:alpha" .
    /usr/local/bin/docker build -t "casualsimulation/aux-proxy:${gitTag}" -t "casualsimulation/aux-proxy:latest" -t "casualsimulation/aux-proxy:alpha" ./src/aux-proxy
    /usr/local/bin/docker build -t "casualsimulation/aux-redirector:${gitTag}" -t "casualsimulation/aux-redirector:latest" -t "casualsimulation/aux-redirector:alpha" ./src/aux-redirector
    """
}

def BuildDockerArm32() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Building..."
    npm run tar:docker
    """

    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identityFile = RPI_SSH_KEY_FILE

    sshPut remote: remote, from: './temp/output.tar.gz', into: '/home/pi'
    sshCommand remote: remote, command: "cd /home/pi; mkdir -p output; tar xzf ./output.tar.gz -C output; cd output; docker build -t ${DOCKER_ARM32_TAG}:${gitTag} -t ${DOCKER_ARM32_TAG}:latest -t ${DOCKER_ARM32_TAG}:alpha -f Dockerfile.arm32 ."
    
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

def PublishDocs() {
    if (env.GIT_BRANCH.endsWith(params.MAIN_BRANCH)) {
        sh """#!/bin/bash
        set -e
        cd docs
        
        echo "Installing NPM Packages..."
        yarn install --frozen-lockfile

        echo "Upgrading Casual Simulation NPM Packages.."
        yarn upgrade --scope @casual-simulation --latest

        echo "Building and deploying..."
        GIT_USER="YETi-DevOps" USE_SSH=true yarn deploy
        """
    } else {
        echo "Skipping Docs."
    }
}

def CreateGithubRelease() {
    // Only create a Github release for main branch builds
    if (env.GIT_BRANCH.endsWith(params.MAIN_BRANCH)) {
        sh """#!/bin/bash
        set -e
        . ~/.bashrc
        echo \$(pwd)
        CHANGELOG=\$(./script/most_recent_changelog.sh)
        node ./src/make-github-release/bin/make-github-release.js release --owner "${AUX_GIT_REPO_OWNER}" --repo ${AUX_GIT_REPO_NAME} --text \"\${CHANGELOG}\" --auth ${GITHUB_RELEASE_TOKEN}
        """
    } else {
        echo "Skipping GitHub release."
    }
}

def PublishDocker() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Publishing the x64 Docker Image...."
    /usr/local/bin/docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}
    /usr/local/bin/docker push casualsimulation/aux:${gitTag}
    /usr/local/bin/docker push casualsimulation/aux-proxy:${gitTag}
    /usr/local/bin/docker push casualsimulation/aux-redirector:${gitTag}
    """

    if (env.GIT_BRANCH.endsWith(params.MAIN_BRANCH)) {
        sh """#!/bin/bash
        set -e
        . ~/.bashrc
        
        echo "Publishing the latest tags...."
        /usr/local/bin/docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}
        /usr/local/bin/docker push casualsimulation/aux:latest
        /usr/local/bin/docker push casualsimulation/aux-proxy:latest
        /usr/local/bin/docker push casualsimulation/aux-redirector:latest
        """
    } else {
        sh """#!/bin/bash
        set -e
        . ~/.bashrc
        
        echo "Publishing the alpha tags...."
        /usr/local/bin/docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD}
        /usr/local/bin/docker push casualsimulation/aux:alpha
        /usr/local/bin/docker push casualsimulation/aux-proxy:alpha
        /usr/local/bin/docker push casualsimulation/aux-redirector:alpha
        """
    }
}

def PublishDockerArm32() {
    def remote = [:]
    remote.name = RPI_HOST
    remote.host = PI_IP
    remote.user = RPI_USER
    remote.allowAnyHosts = true
    remote.identityFile = RPI_SSH_KEY_FILE

    sshCommand remote: remote, command: "docker push ${DOCKER_ARM32_TAG}:${gitTag}"

    if (env.GIT_BRANCH.endsWith(params.MAIN_BRANCH)) {
        sshCommand remote: remote, command: "docker push ${DOCKER_ARM32_TAG}:latest"
    } else {
        sshCommand remote: remote, command: "docker push ${DOCKER_ARM32_TAG}:alpha"
    }
}

def Cleanup() {
    CleanupDocker()
    CleanupDockerArm32()
}

def CleanupDocker() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Removing Unused Docker Images..."
    /usr/local/bin/docker system prune -a -f
    """
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


// Slack message notification functions
def NotifyStarted() {
    try {
        echo "JFDebug: Sending Start Message"
        slackSend(channel: '#casualsim-aux', color: '#FFDF17', message: "STARTED: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}

def NotifySuccessful() {
    try {
        echo "JFDebug: Sending Successful Message"
        slackSend(channel: '#casualsim-aux', color: '#0FAD03', message: "SUCCESSFUL: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}

def NotifyFailed() {
    try {
        echo "JFDebug: Sending Message Failed"
        slackSend(channel: '#casualsim-aux', color: '#CD2900', message: "FAILED: Job '${env.JOB_NAME}'")
    } catch (e) {
        echo "JFDebug: oh well"
    }
}