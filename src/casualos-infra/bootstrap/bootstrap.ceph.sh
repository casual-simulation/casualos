#!/bin/sh
sudo snap install microceph
sudo snap refresh --hold microceph

sudo microceph cluster bootstrap

# wait for ceph to start
until sudo microceph.ceph status; do
    echo "Waiting for ceph to be ready..."
    sleep 5
done

