#!/bin/bash
set -e

newhost="auxplayer"
commands=(-n --hostname -f --full -y --yes -h --help)
docker=false

help_menu() {
    echo ""
    echo "Usage:        install.sh [OPTIONS]"
    echo ""
    echo "Command line tools for AUX dealing more with the hardware/server than auxplayer itself."
    echo ""
    echo "OPTIONS:"
    echo "-n        --hostname      Change the hostname during the setup."
    echo "-f        --full          Do a full install instead of just the core requirements."
    echo "-y        --yes           Auto skips 'Are you sure?'"
    echo "-h        --help          Displays this help information."
    echo ""
    echo "Run 'auxcli COMMAND --help' for more information on a command."
    echo ""
    exit 1
}

err_msg1() {
    echo ""
    echo "\"$1\" is an invalid argument."
    echo "Run 'install.sh -h' for help."
    echo ""
    exit 1
}

err_msg2() {
    echo ""
    echo "\"$2\" is an invalid argument for \"$1\"."
    echo "Run 'install.sh -h' for help."
    echo ""
    exit 1
}

err_chk() {
    if [[ ${commands[*]} =~ $2 ]] || [[ -z "$2" ]]; then
        err_msg2 "$1" "$2"
    fi
}

while [[ $# -gt 0 ]]; do
    case "$1" in
    -n | --hostname)
        err_chk "$1" "$2"
        newhost=$2
        shift # past argument
        shift # past value
        ;;
    -f | --full)
        full=true
        shift # past argument
        ;;
    -y | --yes)
        yes=true
        shift # past argument
        ;;
    -h | --help)
        help_menu
        ;;
    *)
        err_msg1 "$1"
        ;;
    esac
done

boot_config() {
    # Setup Startup Script
    echo "DEBUG: Setting up Crontab..."
    echo "export EDITOR=nano" >>~/.bashrc
    # echo "@reboot sleep 10 && sudo -u pi bash /lib/auxcli/startup" | sudo -u pi crontab -
}

system_settings() {
    # Change Keyboard Layout
    echo "DEBUG: Changing Keyboard Layout..."
    sudo sed -i 's/^XKBLAYOUT=".*\?"/XKBLAYOUT="us"/g' /etc/default/keyboard

    # Modify locale.gen file
    echo "DEBUG: Changing Locales..."
    sudo sed -i 's/^# en_US/en_US/g' /etc/locale.gen
    sudo sed -i 's/^en_GB/# en_GB/g' /etc/locale.gen

    # Generate Locales
    echo "DEBUG: Generating Locales..."
    sudo locale-gen

    # Change Locale
    echo "DEBUG: Updating Locales..."
    sudo update-locale LANG=en_US.UTF-8
    sudo update-locale LANGUAGE=en_US.UTF-8
    . /etc/default/locale
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

system_software() {
    # Update/Upgrade the Software that comes with Raspbian
    echo "DEBUG: Updating System Software..."
    sudo apt-get update || sudo apt update -y
    sudo apt-get upgrade -y

    echo "DEBUG: Installing python3-pip..."
    sudo apt-get install -y python3-pip
    sudo pip3 install --upgrade pip setuptools
}

docker() {
    # Install Docker
    if [ -x "$(command -v docker)" ]; then
        echo "Docker is already installed."
        docker=true
    fi
    if ! $docker; then
        echo "DEBUG: Installing Docker..."

        error_msg="Docker failed to install."
        curl -fsSL https://get.docker.com -o get-docker.sh

        while [[ $(sh get-docker.sh >/dev/null 2>&1 || echo "${error_msg}") == "$error_msg" ]]; do
            sudo rm -rf /var/lib/dpkg/info/docker-ce*
            sleep 1
        done

        # Docker Permissions
        echo "DEBUG: Setting Docker Permissions..."
        sudo gpasswd -a pi docker # takes effect on logout/reboot - need sudo for now
    fi

    # Clean that file up after
    if [ -e /home/pi/get-docker.sh ]; then
        sudo rm -rf /home/pi/get-docker.sh
    fi
}

docker_compose() {
    # Install Docker Compose Dependencies
    echo "DEBUG: Installing Docker Compose Dependencies..."
    sudo apt-get install -y \
    python3-jsonschema \
    python3-requests \
    python3-websocket \
    python3-six \
    python3-cached-property \
    python3-texttable \
    python3-docopt \
    python3-pretty-yaml \
    python3-dockerpty \
    python3-paramiko \
    python3-setuptools \
    python3-attr \
    python3-nacl \
    python3-cryptography \
    python3-bcrypt \
    python3-cffi



    # Install Docker Compose
    echo "DEBUG: Installing Docker Compose..."
    sudo pip3 install docker-compose

    # Get Docker Compose File
    echo "DEBUG: Getting Docker Compose File..." #TODO path of thing
    curl https://raw.githubusercontent.com/casual-simulation/aux/master/docker/docker-compose.arm32.yml --output docker-compose.yml

    # Start DockerCompose
    echo "DEBUG: Starting Docker Compose..."
    error_msg="Docker Compose failed to start."
    # Works after reboot. don't know if required.
    sudo docker-compose pull && sudo docker-compose up -d || echo "$error_msg"
}

get_cli() {
    # Check the path to make sure helpers can be found
    if ! [[ "$PATH" == *":/lib/auxcli/commands/helper"* ]]; then
    export PATH=$PATH:/lib/auxcli/commands/helper
    fi

    echo "DEBUG: Getting AUXCLI..."
    curl https://raw.githubusercontent.com/casual-simulation/aux-cli/master/install.sh --output install-cli.sh && sudo bash install-cli.sh
    sudo rm -rf install-cli.sh
}

run_steps() {
    if ! $yes; then
        read -p "Are you sure you want to install AUX? Press 'y' to continue or press anything else to exit." -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Installing AUX now."
        else
            exit 1
        fi
    fi
    boot_config
    system_settings
    ssh_enable
    system_software
    docker
    docker_compose
    get_cli
    echo "DEBUG: Changing Hostname..."
    auxcli changehost -n "${newhost}"
    if $full; then
        echo "DEBUG: Beginning AUXLCI Full Install..."
        auxcli install everything
        echo "DEBUG: AUXLCI Full Install Complete"
    fi
}

run_steps

echo "DEBUG: casualOS Installation Complete."
sudo rm -rf install.sh

echo "The rest of the setup will complete after a reboot. This may take 10-20 minutes depending on your connection."
read -rep $'Press "y" to reboot now or press anything else to wait.\n' -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo reboot now
fi
