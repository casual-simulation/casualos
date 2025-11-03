
terraform {
    required_version = ">= 1.10"

    required_providers {
      aws = {
        version = ">= 6.0"
      }
      kubernetes = {
        version = ">= 2.38.0"
      }
    }
}

resource "random_string" "deployment_id" {
    length = 6
    special = false
}

resource "random_password" "cluster_token" {
    length = 32
    special = false
}

locals {
    project_name = "${var.project_name}-${random_string.deployment_id.result}"
}

// The bucket for storing file records
resource "aws_s3_bucket" "files_bucket" {
    bucket = "${local.project_name}-files-bucket"

    lifecycle {
      prevent_destroy = true
    }

    tags = {
      Name = "${local.project_name}-files-bucket"
      Environment = var.environment
      Project = var.project_name
      Customer = var.customer
    }
}

resource "aws_s3_bucket_public_access_block" "files_bucket_public_access_block" {
    bucket = aws_s3_bucket.files_bucket.id

    block_public_acls       = false
    block_public_policy     = false
    ignore_public_acls      = false
    restrict_public_buckets = false
}

resource "aws_s3_ownership_controls" "files_bucket_ownership_controls" {
    bucket = aws_s3_bucket.files_bucket.id

    rule {
        object_ownership = "BucketOwnerPreferred"
    }
}

resource "aws_s3_bucket_cors_configuration" "files_bucket_cors" {
    bucket = aws_s3_bucket.files_bucket.id

    cors_rule {
        allowed_headers = ["*"]
        allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
        allowed_origins = ["*"]
        expose_headers  = ["ETag"]
        max_age_seconds = 3000
    }
}

data "aws_ami" "ubuntu" {
    most_recent = true

    filter {
        name   = "name"
        values = ["ubuntu/images/hvm-ssd/ubuntu-24.04-amd64-server-*"]
    }

    filter {
        name   = "virtualization-type"
        values = ["hvm"]
    }

    owners = ["099720109477"] # Canonical
}

resource "tls_private_key" "cluster_key" {
    algorithm = "ED25519"
}


resource "aws_key_pair" "cluster_key_pair" {
    key_name   = "${local.project_name}-key"
    public_key = tls_private_key.cluster_key.public_key_pem
}

resource "aws_vpc" "cluster_vpc" {
    cidr_block = "10.0.0.0/8"
    instance_tenancy = "default"

    tags = {
        Name = "${local.project_name}-vpc"
        Environment = var.environment
        Project = var.project_name
        Customer = var.customer
    }
}

resource "aws_subnet" "cluster_subnet" {
    vpc_id            = aws_vpc.cluster_vpc.id
    cidr_block        = "10.0.0.0/8"
}

# The primary cluster node
# This is the first node that is created in the cluster
resource "aws_instance" "cluster_primary" {
    ami           = data.aws_ami.ubuntu.id
    instance_type = var.primary_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name
    associate_public_ip_address = true
    subnet_id = aws_subnet.cluster_subnet.id

    tags = {
      Name        = "${local.project_name}-primary"
      Environment = var.environment
      Project     = var.project_name
      Customer    = var.customer
    }

    user_data_base64 = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/primary_cluster_launch_config.tftpl", {
                token = random_string.cluster_token.result
            })
        })
    )
}

# Launch configuration for secondary cluster nodes
# These nodes help run the k8s control plane
resource "aws_launch_configuration" "cluster_secondary_launch_configuration" {
    name_prefix   = "${local.project_name}-lc-"
    image_id      = data.aws_ami.ubuntu.id
    instance_type = var.secondary_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name

    lifecycle {
        create_before_destroy = true
    }

    user_data = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/secondary_cluster_launch_config.tftpl", {
                token = random_string.cluster_token.result,
            })
        })
    )
}

# Launch configuration for worker nodes
# These nodes run the workloads
resource "aws_launch_configuration" "cluster_worker_launch_configuration" {
    name_prefix   = "${local.project_name}-lc-"
    image_id      = data.aws_ami.ubuntu.id
    instance_type = var.worker_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name

    lifecycle {
        create_before_destroy = true
    }

    user_data = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/secondary_cluster_launch_config.tftpl", {
                token = random_string.cluster_token.result,
                worker = true
            })
        })
    )
}

# The autoscaling group for secondary cluster nodes
resource "aws_autoscaling_group" "cluster_asg" {
    name_prefix          = "${local.project_name}-cluster-asg-"
    max_size             = var.max_secondary_nodes
    min_size             = var.min_secondary_nodes
    desired_capacity     = var.desired_secondary_nodes
    launch_configuration = aws_launch_configuration.cluster_secondary_launch_configuration.name
    vpc_zone_identifier  = [aws_subnet.cluster_subnet.id]

    tag {
        key                 = "Name"
        value               = "${local.project_name}-cluster-asg"
        propagate_at_launch = true
    }

    tag {
        key                 = "Environment"
        value               = var.environment
        propagate_at_launch = true
    }

    tag {
        key                 = "Project"
        value               = var.project_name
        propagate_at_launch = true
    }

    tag {
        key                 = "Customer"
        value               = var.customer
        propagate_at_launch = true
    }
}

# The autoscaling group for worker nodes
resource "aws_autoscaling_group" "worker_asg" {
    name_prefix          = "${local.project_name}-worker-asg-"
    max_size             = var.max_worker_nodes
    min_size             = var.min_worker_nodes
    desired_capacity     = var.desired_worker_nodes
    launch_configuration = aws_launch_configuration.cluster_worker_launch_configuration.name
    vpc_zone_identifier  = [aws_subnet.cluster_subnet.id]

    tag {
        key                 = "Name"
        value               = "${local.project_name}-worker-asg"
        propagate_at_launch = true
    }

    tag {
        key                 = "Environment"
        value               = var.environment
        propagate_at_launch = true
    }

    tag {
        key                 = "Project"
        value               = var.project_name
        propagate_at_launch = true
    }

    tag {
        key                 = "Customer"
        value               = var.customer
        propagate_at_launch = true
    }
}
