
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

resource "random_password" "k8s_encryption_secret" {
    length = 32
}

resource "random_password" "k8s_bootstrap_token_secret" {
    length = 16
    special = false
}

resource "random_string" "k8s_bootstrap_token_id" {
    length = 6
    special = false
    upper = false
    lower = true
}

locals {
    project_name = "${var.project_name}-${random_string.deployment_id.result}"
    k8s_bootstrap_token = sensitive("${random_string.k8s_bootstrap_token_id.result}.${random_password.k8s_bootstrap_token_secret.result}")
}

output "k8s_bootstrap_token" {
    value = local.k8s_bootstrap_token
    sensitive = true
}

// The bucket for storing file records
resource "aws_s3_bucket" "files_bucket" {
    bucket = "${lower(local.project_name)}-files-bucket"

    # lifecycle {
    #   prevent_destroy = true
    # }

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

resource "aws_s3_bucket_ownership_controls" "files_bucket_ownership_controls" {
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

resource "tls_private_key" "cluster_key" {
    algorithm = "ED25519"
}

output "cluster_ssh_private_key" {
    value     = tls_private_key.cluster_key.private_key_pem
    sensitive = true
}

resource "aws_key_pair" "cluster_key_pair" {
    key_name   = "${local.project_name}-key"
    public_key = tls_private_key.cluster_key.public_key_openssh
}

# TODO: Add VPC, Subnets, and NAT Gateway resources
# resource "aws_vpc" "cluster_vpc" {
#     cidr_block = "10.0.0.0/16"
#     instance_tenancy = "default"
#     enable_dns_hostnames = true
#     enable_dns_support = true

#     tags = {
#         Name = "${local.project_name}-vpc"
#         Environment = var.environment
#         Project = var.project_name
#         Customer = var.customer
#     }
# }

# resource "aws_subnet" "cluster_subnet" {
#     vpc_id            = aws_vpc.cluster_vpc.id
#     cidr_block        = "10.0.0.0/24"
#     # map_public_ip_on_launch = true
# }

# resource "aws_subnet" "private_subnet" {
#     vpc_id            = aws_vpc.cluster_vpc.id
#     cidr_block        = "10.0.1.0/24"
#     map_public_ip_on_launch = false
# }

resource "aws_security_group" "cluster_security_group" {
    name        = "${lower(local.project_name)}-sg"
    description = "Security group for the ${local.project_name} cluster"
}

resource "aws_vpc_security_group_ingress_rule" "allow_tls" {
    security_group_id = aws_security_group.cluster_security_group.id
    from_port                = 443
    to_port                  = 443
    ip_protocol = "tcp"
    cidr_ipv4 = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "allow_http" {
    security_group_id = aws_security_group.cluster_security_group.id
    from_port                = 80
    to_port                  = 80
    ip_protocol = "tcp"
    cidr_ipv4 = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "allow_ssh_inbound" {
    security_group_id = aws_security_group.cluster_security_group.id
    from_port                = 22
    to_port                  = 22
    ip_protocol = "tcp"
    cidr_ipv4 = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "allow_k8s_api" {
    security_group_id = aws_security_group.cluster_security_group.id
    from_port                = 16443
    to_port                  = 16443
    ip_protocol = "tcp"
    cidr_ipv4 = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "allow_all_traffic_ipv4" {
  security_group_id = aws_security_group.cluster_security_group.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1" # semantically equivalent to all ports
}

# The primary cluster node
# This is the first node that is created in the cluster
resource "aws_instance" "cluster_primary" {
    depends_on = [ 
        aws_vpc_security_group_ingress_rule.allow_tls,
        aws_vpc_security_group_ingress_rule.allow_http,
        aws_vpc_security_group_ingress_rule.allow_ssh_inbound,
        aws_vpc_security_group_ingress_rule.allow_k8s_api,
        aws_vpc_security_group_egress_rule.allow_all_traffic_ipv4
    ]
    ami           = var.ami_id
    instance_type = var.primary_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name
    associate_public_ip_address = true
    security_groups = [ aws_security_group.cluster_security_group.name ]

    tags = {
      Name        = "${local.project_name}-primary"
      Environment = var.environment
      Project     = var.project_name
      Customer    = var.customer
    }

    user_data_base64 = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/config/primary_cluster_launch_config.tftpl", {
                token = random_password.cluster_token.result
                encryption_secret = base64encode(random_password.k8s_encryption_secret.result)
            })
            bootstrap = base64encode(templatefile("${path.module}/config/bootstrap.tftpl", {
                token_id = random_string.k8s_bootstrap_token_id.result
                token_secret = random_password.k8s_bootstrap_token_secret.result
            }))
        })
    )
}

output "cluster_primary_ip" {
    value = aws_instance.cluster_primary.public_ip
}

# Launch configuration for secondary cluster nodes
# These nodes help run the k8s control plane
resource "aws_launch_configuration" "cluster_secondary_launch_configuration" {
    name_prefix   = "${local.project_name}-lc-"
    image_id      = var.ami_id
    instance_type = var.secondary_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name
    security_groups = [ aws_security_group.cluster_security_group.name ]

    lifecycle {
        create_before_destroy = true
    }

    user_data = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/config/secondary_cluster_launch_config.tftpl", {
                token = random_password.cluster_token.result,
                encryption_secret = base64encode(random_password.k8s_encryption_secret.result)
                worker = false
            })
            bootstrap = ""
        })
    )
}

# Launch configuration for worker nodes
# These nodes run the workloads
resource "aws_launch_configuration" "cluster_worker_launch_configuration" {
    name_prefix   = "${local.project_name}-lc-"
    image_id      = var.ami_id
    instance_type = var.worker_instance_type
    key_name      = aws_key_pair.cluster_key_pair.key_name
    security_groups = [ aws_security_group.cluster_security_group.name ]

    lifecycle {
        create_before_destroy = true
    }

    user_data = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = templatefile("${path.module}/config/secondary_cluster_launch_config.tftpl", {
                token = random_password.cluster_token.result,
                encryption_secret = base64encode(random_password.k8s_encryption_secret.result)
                worker = true
            })
            bootstrap = ""
        })
    )
}

# The autoscaling group for secondary cluster nodes
# resource "aws_autoscaling_group" "cluster_asg" {
#     name_prefix          = "${local.project_name}-cluster-asg-"
#     max_size             = var.max_secondary_nodes
#     min_size             = var.min_secondary_nodes
#     desired_capacity     = var.desired_secondary_nodes
#     launch_configuration = aws_launch_configuration.cluster_secondary_launch_configuration.name
#     # vpc_zone_identifier  = [aws_subnet.cluster_subnet.id]

#     tag {
#         key                 = "Name"
#         value               = "${local.project_name}-cluster-asg"
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Environment"
#         value               = var.environment
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Project"
#         value               = var.project_name
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Customer"
#         value               = var.customer
#         propagate_at_launch = true
#     }
# }

# # The autoscaling group for worker nodes
# resource "aws_autoscaling_group" "worker_asg" {
#     name_prefix          = "${local.project_name}-worker-asg-"
#     max_size             = var.max_worker_nodes
#     min_size             = var.min_worker_nodes
#     desired_capacity     = var.desired_worker_nodes
#     launch_configuration = aws_launch_configuration.cluster_worker_launch_configuration.name
#     # vpc_zone_identifier  = [aws_subnet.cluster_subnet.id]

#     tag {
#         key                 = "Name"
#         value               = "${local.project_name}-worker-asg"
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Environment"
#         value               = var.environment
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Project"
#         value               = var.project_name
#         propagate_at_launch = true
#     }

#     tag {
#         key                 = "Customer"
#         value               = var.customer
#         propagate_at_launch = true
#     }
# }

locals {
    cluster_endpoint = "https://${aws_instance.cluster_primary.public_ip}:16443"
}

provider "kubernetes" {
    host = local.cluster_endpoint
    token = local.k8s_bootstrap_token
    username = "system:bootstrap:${random_string.k8s_bootstrap_token_id.result}"
    insecure = true
}

resource "kubernetes_namespace" "prod" {
    metadata {
        name = "prod"
        labels = {
            environment = "prod"
        }
    }
}

resource "kubernetes_pod" "test" {
  metadata {
    name = "terraform-example"
    namespace = kubernetes_namespace.prod.metadata[0].name
  }

  spec {
    container {
      image = "nginx:1.21.6"
      name  = "example"

      env {
        name  = "environment"
        value = "test"
      }

      port {
        container_port = 80
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 80

          http_header {
            name  = "X-Custom-Header"
            value = "Awesome"
          }
        }

        initial_delay_seconds = 3
        period_seconds        = 3
      }
    }
  }
}

resource "kubernetes_service" "test_service" {
  metadata {
    name      = "terraform-example-service"
    namespace = kubernetes_namespace.prod.metadata[0].name
  }

  spec {
    selector = {
      app = kubernetes_pod.test.metadata[0].name
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "LoadBalancer"

    external_ips = [aws_instance.cluster_primary.public_ip]
  }
}