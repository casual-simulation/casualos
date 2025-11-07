#!/bin/sh
set -e

mkdir -p /var/snap/microk8s/common/
mkdir -p /var/snap/microk8s/common/certs/
LAUNCH_CONFIG=$(echo "${launch_config}" | base64 -d)
CA_CERT=$(echo "${ca_cert}" | base64 -d)
CA_KEY=$(echo "${ca_key}" | base64 -d)
echo "$LAUNCH_CONFIG" > "/var/snap/microk8s/common/.microk8s.yaml"

ATTACH_DEVICE=$(echo "${attach_device}" | base64 -d)
ATTACH_DEVICE_MOUNT_PATH=$(echo "${attach_device_mount_path}" | base64 -d)

if [ -n "$ATTACH_DEVICE" ] && [ -n "$ATTACH_DEVICE_MOUNT_PATH" ]; then
    echo "Attaching device $ATTACH_DEVICE to $ATTACH_DEVICE_MOUNT_PATH ..."
    while [ ! -e $ATTACH_DEVICE ]; do
        echo "Waiting for device $ATTACH_DEVICE to be available..."
        sleep 5
    done

    # Format the device --> Create Filesystem
    if ! sudo blkid "$ATTACH_DEVICE" >/dev/null 2>&1; then
        echo "Creating filesystem on $ATTACH_DEVICE"
        sudo mkfs.ext4 "$ATTACH_DEVICE"
    fi

    sudo mkdir -p "$ATTACH_DEVICE_MOUNT_PATH"

    # Retrieve UUID of the device
    DEVICE_UUID=$(blkid -s UUID -o value "$ATTACH_DEVICE")
    echo "Device UUID: $DEVICE_UUID"

    # input fstab Entry
    if ! grep -q "$DEVICE_UUID" /etc/fstab; then
        sudo echo "UUID=$DEVICE_UUID $ATTACH_DEVICE_MOUNT_PATH ext4 defaults,nofail 0 2" >> /etc/fstab
    fi

    sudo mount "$ATTACH_DEVICE_MOUNT_PATH" || mount -a

    sudo chown -R root:root "$ATTACH_DEVICE_MOUNT_PATH"
    sudo chmod 755 "$ATTACH_DEVICE_MOUNT_PATH"

    echo "Done."
fi

if [ -n "$CA_CERT" ] && [ -n "$CA_KEY" ]; then
    echo "Installing custom certs..."
    echo "$CA_CERT" > "/var/snap/microk8s/common/certs/ca.crt"
    echo "$CA_KEY" > "/var/snap/microk8s/common/certs/ca.key"
    echo "Done."
fi

sudo snap install microk8s --classic --channel 1.32/stable

# wait for microk8s to start
until microk8s.status --wait-ready; do
    echo "Waiting for microk8s to be ready..."
    sleep 5
done

echo "Microk8s is ready!"

if [ -n "$CA_CERT" ] && [ -n "$CA_KEY" ]; then
    echo "Refreshing certs..."
    sudo microk8s refresh-certs /var/snap/microk8s/common/certs
    echo "Done."
fi

BOOTSTRAP=$(echo "${bootstrap}" | base64 -d)
if [ -n "$BOOTSTRAP" ]; then
    echo "Applying bootstrap..."
    echo "$BOOTSTRAP" > /var/snap/microk8s/common/bootstrap.yaml
    until sudo microk8s kubectl apply -f /var/snap/microk8s/common/bootstrap.yaml do
        echo "Failed to apply bootstrap. Retrying in 5 seconds..."
        sleep 5
    done
    echo "Bootstrap applied!"
fi

echo "Bootstrap complete!"