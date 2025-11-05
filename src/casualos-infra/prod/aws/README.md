# AWS Deployment

## Requirements

Ensure that the following are installed:

-   [OpenTofu](http://opentofu.org/)
-   [AWS CLI](https://aws.amazon.com/cli/)
-   [kubectl](https://kubernetes.io/docs/reference/kubectl/)

## Usage

To deploy, follow these steps:

1. Ensure that you have an access key and secret access key setup for AWS.
    - You can do this by running `aws configure`
2. Open a terminal in this directory.
3. Run the following:
    - `$ tofu init`
    - It will ask you to specify an S3 bucket and a passphrase for encrypting the state.
4. Setup environment variables (or a `.tfvars` file) for ease of use:
    - `TF_VAR_passphrase` - Set this to the passphrase for the state.
    - `TF_VAR_aws_region` - Set this to the AWS region you want to deploy to.
    - `AWS_PROFILE` - Set this to the AWS profile you want to use.
5. Deploy the primary instance first:
    - `$ tofu apply -target="aws_eip_association.cluster_primary_eip_association"`
    - We need to run this first because the kubernetes terraform provider tries to access the cluster before it is ready. (it is really annoying, but this has been a bug in terraform for years)
    - This step is only required when starting the cluster for the first time.
6. Deploy the rest of the system:
    - `$ tofu apply`

### Setup kubectl

1. Once deployed, you can download the kubectl file to access the cluster:
    - `$ tofu output -raw k8s_kubectl_config > "~/.kube/config"`
2. Now you can access the cluster:
    - `$ kubectl get nodes`
