
pipeline {
    agent any

    tools {
        nodejs('Node10.13.0')
    }

    stages {
        stage('Setup') {
            steps {
                NotifyStarted()
                InstallNPMPackages()
            }
        }
        stage('Build and Deploy') {
            steps {
                Build()
            }
        }
    }
    post {
        success {
            NotifySuccessful()
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
    yarn install --frozen-lockfile
    """
}

def Build() {
    sh """#!/bin/bash
    set -e
    . ~/.bashrc
    
    echo "Building and deploying..."
    GIT_USER="YETi-DevOps" USE_SSH=true yarn deploy
    """
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