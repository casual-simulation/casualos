#!/bin/bash

# TODO: Fix to work for sudo -u
# if [ "$EUID" -ne 0 ]
#   then echo "Please run as sudo -u *your_username*"
#   exit
# fi

# Create the folders that are needed
mkdir -p /data/gitlab/config
mkdir -p /data/gitlab/logs
mkdir -p /data/gitlab/data/git-data/repositories

# Assign Read, Write, and Execute permissions to everyone
chmod -R 777 /data/gitlab

# Make sure the git-data folder and subfolders have
# the right permissions.
chmod -R 2770 /data/gitlab/data/git-data