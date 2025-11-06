#!/bin/sh
set -e

mkdir -p /var/snap/microk8s/common/
mkdir -p /var/snap/microk8s/common/certs/
LAUNCH_CONFIG=$(echo "${launch_config}" | base64 -d)
CA_CERT=$(echo "${ca_cert}" | base64 -d)
CA_KEY=$(echo "${ca_key}" | base64 -d)
echo "$LAUNCH_CONFIG" > "/var/snap/microk8s/common/.microk8s.yaml"

if [ -n "$CA_CERT" ] && [ -n "$CA_KEY" ]; then
    echo "$CA_CERT" > "/var/snap/microk8s/common/certs/ca.crt"
    echo "$CA_KEY" > "/var/snap/microk8s/common/certs/ca.key"
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
    sudo microk8s kubectl apply -f /var/snap/microk8s/common/bootstrap.yaml
    echo "Bootstrap applied!"
fi

echo "Bootstrap complete!"