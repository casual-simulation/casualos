#!/bin/sh
set -e

mkdir -p /var/snap/microk8s/common/
echo "${launch_config}" > "/var/snap/microk8s/common/.microk8s.yaml"

sudo snap install microk8s --classic --channel 1.32/stable

# wait for microk8s to start
until microk8s.status --wait-ready; do
    echo "Waiting for microk8s to be ready..."
    sleep 5
done

echo "Microk8s is ready!"
BOOTSTRAP=$(echo "${bootstrap}" | base64 -d)
if [ -n "$BOOTSTRAP" ]; then
    echo "Applying bootstrap..."
    echo "$BOOTSTRAP" > /var/snap/microk8s/common/bootstrap.yaml
    microk8s kubectl apply -f /var/snap/microk8s/common/bootstrap.yaml
    echo "Bootstrap applied!"
fi
