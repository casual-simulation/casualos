#!/bin/bash
set -e

newhost="auxplayer"

while [ "$1" != "" ]; do
    case $1 in
    -n | --hostname)
        newhost=$2
        break
        ;;
    -h | --help)
        echo "Run 'aux-setup.sh -n MyCoolName' to change your hostname right away."
        exit 1
        ;;
    *)
        echo "Run 'aux-setup.sh -n MyCoolName' to change your hostname right away."
        exit 1
        ;;
    esac
    shift
done

boot_config() {
    # Setup Startup Script
    echo "DEBUG: Setting up Crontab..."
    echo "export EDITOR=nano" >>~/.bashrc
    echo "@reboot sudo -u pi bash /lib/aux-cli/startup" | sudo -u pi crontab -
}

system_settings() {
    # Change Keyboard Layout
    echo "DEBUG: Changing Keyboard Layout..."
    sudo sed -i 's/XKBLAYOUT=".*\?"/XKBLAYOUT="us"/g' /etc/default/keyboard

    # Modify locale.gen file
    echo "DEBUG: Changing Locales..."
    sudo sed -i 's/# en_US/en_US/g' /etc/locale.gen
    sudo sed -i 's/en_GB/# en_GB/g' /etc/locale.gen

    # Generate Locales
    echo "DEBUG: Generating Locales..."
    sudo locale-gen

    # Change Locale
    echo "DEBUG: Updating Locales..."
    sudo update-locale LANG=en_US.UTF-8
    sudo update-locale LANGUAGE=en_US.UTF-8
}

ssh_enable() {
    # Enable SSH
    echo "DEBUG: Enabling SSH..."
    if [ -n "$(pgrep '[s]shd')" ]; then
        echo "SSHD is already enabled."
    else
        echo "Enabling SSHD."
        sudo systemctl enable sshd
    fi
}

docker() {
    # Install Docker
    if docker -v >/dev/null 2>&1; then
        echo "Docker is already installed."
    else
        echo "DEBUG: Installing Docker..."
        curl -fsSL get.docker.com -o get-docker.sh && sh get-docker.sh
    fi

    # Docker Permissions
    echo "DEBUG: Setting Docker Permissions..."
    sudo gpasswd -a pi docker # takes effect on logout/reboot - need sudo for now

    # Clean that file up after
    if [ -e /home/pi/get-docker.sh ]; then
        sudo rm -rf /home/pi/get-docker.sh
    fi
}

system_software() {
    # Update/Upgrade the Software that comes with Raspbian
    sudo apt-get update
    sudo apt-get upgrade -y

    sudo apt-get install -y python3-pip
    sudo pip3 install --upgrade pip setuptools
}

docker_compose() {
    # Install Docker Compose
    echo "DEBUG: Installing Docker Compose..."
    sudo pip3 install docker-compose

    # Get Docker Compose File
    echo "DEBUG: Getting Docker Compose File..." #TODO path of thing
    curl https://raw.githubusercontent.com/casual-simulation/aux/master/docker-compose.arm32.yml --output docker-compose.yml

    # Start DockerCompose
    echo "DEBUG: Starting Docker Compose..."
    error_msg="Docker Compose failed to start."
    # Works after reboot. don't know if required.
    sudo docker-compose pull && sudo docker-compose up -d || echo "$error_msg"
    # while [[ $(sudo docker-compose up -d || echo "$error_msg") == "$error_msg" ]]; do
    #     echo "Docker isn't started yet."
    #     sleep 1
    # done
}

get_cli() { 
    curl https://raw.githubusercontent.com/casual-simulation/aux-cli/master/install.sh --output install.sh && bash install.sh
    sudo rm -rf install.sh
}

run_steps() {
    echo "DEBUG: Starting Setup..."
    boot_config
    system_settings
    ssh_enable
    docker
    system_software
    docker_compose
    get_cli
    aux-cli changehost -n "${newhost}" -r
}

run_steps
