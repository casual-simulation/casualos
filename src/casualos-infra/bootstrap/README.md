## CasualOS Cluster Bootstrap

This folder contains scripts which help to bootstrap a new Microk8s cluster with all the required services.

### Instructions

1. First, make sure you have one or more Linux machines with the following installed:
    - [snap](https://snapcraft.io/docs/installing-snapd)
2. Ensure that all machines on the same network.
    - This can be configured in many different ways.
3. Run the following script on all the machines you want to bootstrap:
    - [bootstrap.sh](./bootstrap.sh)
4. For each extra machine, run the following command on the machine you want to be the master: - `microk8s add-node` - It will output another command that should be run on the other machines to join them to the cluster.
 <!-- 4. If you bootstrapped at least 3 machines, you can setup failure domains:
     -   ```bash
         echo "failure-domain=42" > /var/snap/microk8s/current/args/ha-conf`
         microk8s.stop
         microk8s.start
         ```
     -   Only run this script on the machines that you want to be part of providing k8s high-availability.
     -   A quorum (`floor(N/2) + 1`) is always required, so three machines is the minimum required for effective HA (at least 2 need to be running). A group of 5 machines would allow two machines to go down before availability is compromised. -->
