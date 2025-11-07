
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

locals {
    project_name = "${var.project_name}-${random_string.deployment_id.result}"
    k8s_encryption_secret = sensitive(base64encode(random_password.k8s_encryption_secret.result))
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

resource "aws_sns_topic" "search_jobs" {
    name = "${local.project_name}-search-jobs-topic"

    tags = {
      Name = "${local.project_name}-search-jobs-topic"
      Environment = var.environment
      Project = var.project_name
      Customer = var.customer
    }
}

resource "tls_private_key" "cluster_ssh_key" {
    algorithm = "ED25519"
}

resource "tls_private_key" "cluster_ca_key" {
    algorithm = "RSA"
    rsa_bits = 4096
}

resource "tls_self_signed_cert" "cluster_ca" {
    private_key_pem = tls_private_key.cluster_ca_key.private_key_pem

    allowed_uses = [
        "crl_signing",
        "cert_signing",
    ]

    subject {
      common_name = "CA"
    }

    is_ca_certificate = true

    validity_period_hours = 24 * 365 * 10 // 10 years
}

resource "tls_private_key" "terraform_k8s_client_key" {
    algorithm = "RSA"
    rsa_bits = 4096
}

resource "tls_cert_request" "terraform_k8s_client_csr" {
    private_key_pem = tls_private_key.terraform_k8s_client_key.private_key_pem

    subject {
        common_name  = "terraform"
        organization = "terraform:admin"
    }
}

resource "tls_locally_signed_cert" "terraform_k8s_client_cert" {
    cert_request_pem = tls_cert_request.terraform_k8s_client_csr.cert_request_pem
    ca_private_key_pem = tls_private_key.cluster_ca_key.private_key_pem
    ca_cert_pem = tls_self_signed_cert.cluster_ca.cert_pem

    validity_period_hours = 24 * 365 * 10 // 10 years

    allowed_uses = [
        "server_auth",
        "client_auth",
    ]
}

resource "tls_private_key" "admin_k8s_client_key" {
    algorithm = "RSA"
    rsa_bits = 4096
}

resource "tls_cert_request" "admin_k8s_client_csr" {
    private_key_pem = tls_private_key.admin_k8s_client_key.private_key_pem

    subject {
        common_name  = "admin"
        organization = "system:masters"
    }
}

resource "tls_locally_signed_cert" "admin_k8s_client_cert" {
    cert_request_pem = tls_cert_request.admin_k8s_client_csr.cert_request_pem
    ca_private_key_pem = tls_private_key.cluster_ca_key.private_key_pem
    ca_cert_pem = tls_self_signed_cert.cluster_ca.cert_pem

    validity_period_hours = 24 * 365 * 10 // 10 years

    allowed_uses = [
        "server_auth",
        "client_auth",
    ]
}

output "k8s_admin_client_cert" {
    value     = tls_locally_signed_cert.admin_k8s_client_cert.cert_pem
    sensitive = true
    description = "The client certificate for the k8s admin user"
}

output "k8s_admin_client_key" {
    value     = tls_private_key.admin_k8s_client_key.private_key_pem
    sensitive = true
    description = "The private key for the k8s admin user"
}

output "k8s_cluster_ca_cert" {
    value = tls_self_signed_cert.cluster_ca.cert_pem
    sensitive = true
    description = "The certificate for the k8s cluster certificate authority"
}

output "cluster_ssh_private_key" {
    value     = tls_private_key.cluster_ssh_key.private_key_pem
    sensitive = true
    description = "The SSH key that can be used to SSH into the AWS instances"
}

resource "aws_key_pair" "cluster_ssh_key_pair" {
    key_name   = "${local.project_name}-key"
    public_key = tls_private_key.cluster_ssh_key.public_key_openssh
}

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

resource "aws_eip" "cluster_primary_eip" {
    tags = {
      Name = "${local.project_name}-primary-eip"
      Environment = var.environment
      Project = var.project_name
      Customer = var.customer
    }
}

locals {
    cluster_primary_ip = aws_eip.cluster_primary_eip.public_ip
    availability_zone_primary = "${var.aws_region}${var.aws_availability_zone_primary}"
}

resource "aws_ebs_volume" "cluster_primary_image_storage" {
    availability_zone = local.availability_zone_primary
    size = 20
    type = "gp3"

    tags = {
      Name = "${local.project_name}-primary-image-storage"
      Environment = var.environment
      Project = var.project_name
      Customer = var.customer
    }
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
    key_name      = aws_key_pair.cluster_ssh_key_pair.key_name
    security_groups = [ aws_security_group.cluster_security_group.name ]
    availability_zone = local.availability_zone_primary

    tags = {
      Name        = "${local.project_name}-primary"
      Environment = var.environment
      Project     = var.project_name
      Customer    = var.customer
    }

    user_data_base64 = base64encode(
        templatefile("${path.module}/script/bootstrap_microk8s.sh", {
            launch_config = base64encode(templatefile("${path.module}/config/primary_cluster_launch_config.tftpl", {
                token = random_password.cluster_token.result
                encryption_secret = local.k8s_encryption_secret
                primary_ip = local.cluster_primary_ip
            }))
            ca_cert = base64encode(tls_self_signed_cert.cluster_ca.cert_pem)
            ca_key = base64encode(tls_private_key.cluster_ca_key.private_key_pem)
            bootstrap = base64encode(templatefile("${path.module}/config/bootstrap.tftpl", {}))
            attach_device = base64encode("/dev/nvme1n1")
            attach_device_mount_path = base64encode("/var/snap/microk8s/common")
        })
    )

    lifecycle {
        ignore_changes = [ user_data_base64 ]
    }
}

resource "aws_volume_attachment" "cluster_primary_image_storage_attachment" {
    device_name = "/dev/sdh" // this is pointless
    volume_id   = aws_ebs_volume.cluster_primary_image_storage.id
    instance_id = aws_instance.cluster_primary.id
}

resource "aws_eip_association" "cluster_primary_eip_association" {
    depends_on = [ aws_volume_attachment.cluster_primary_image_storage_attachment ]
    instance_id   = aws_instance.cluster_primary.id
    allocation_id = aws_eip.cluster_primary_eip.id
}

output "cluster_primary_ip" {
    value = local.cluster_primary_ip
    description = "The public IP address of the primary cluster node"
}

locals {
    cluster_endpoint = "https://${local.cluster_primary_ip}:16443"
}

output "k8s_cluster_endpoint" {
    value = local.cluster_endpoint
    description = "The endpoint that the k8s cluster can be reached at."
}

output "k8s_kubectl_config" {
    value = templatefile("${path.module}/client/kubectl.tftpl", {
        cluster_name = local.project_name
        project_name = var.project_name
        cert_authority_data = base64encode(tls_self_signed_cert.cluster_ca.cert_pem)
        client_cert_data = base64encode(tls_locally_signed_cert.admin_k8s_client_cert.cert_pem)
        client_key_data = base64encode(tls_private_key.admin_k8s_client_key.private_key_pem)
        server = local.cluster_endpoint
    })
    sensitive = true
    description = "The kubectl config file to access the cluster."
}

provider "kubernetes" {
    host = local.cluster_endpoint

    client_certificate = tls_locally_signed_cert.terraform_k8s_client_cert.cert_pem
    client_key = tls_private_key.terraform_k8s_client_key.private_key_pem
    cluster_ca_certificate = tls_self_signed_cert.cluster_ca.cert_pem
}

resource "kubernetes_namespace" "prod" {
    depends_on = [ 
        aws_eip_association.cluster_primary_eip_association,
        aws_volume_attachment.cluster_primary_image_storage_attachment,
        aws_instance.cluster_primary,
        tls_self_signed_cert.cluster_ca,
    ]

    metadata {
        name = "prod"
        labels = {
            environment = "prod"
        }
    }
}

locals {
    input_server_config = var.casualos_server_config
    server_config = merge(
        local.input_server_config,
        {
            prisma: merge({
                options: {
                    datasourceUrl: var.casualos_database_url
                }
            }, try(local.input_server_config.prisma, {})),
            s3: merge({
                region: var.aws_region,
                filesBucket: aws_s3_bucket.files_bucket.bucket,
                filesStorageClass: var.files_storage_class,
                options: try(local.input_server_config.s3.options, {})
            }, try(local.input_server_config.s3, {})),
            ws: try(local.input_server_config.ws, {}),
            jobs: merge({
                search: merge({
                    type: "sns",
                    topicArn: aws_sns_topic.search_jobs.arn,
                }, try(local.input_server_config.jobs.search, {})),
            }, try(local.input_server_config.jobs, {})),
        },
    )
}

output "casualos_server_config" {
    value = jsonencode(local.server_config)
    sensitive = true
    description = "The server config that was produced for the casualos pod."
}

resource "kubernetes_pod" "casualos" {
  metadata {
    name = "casualos"
    namespace = kubernetes_namespace.prod.metadata[0].name
    labels = {
        app = "casualos"
    }
  }

  spec {
    container {
      image = "${var.casualos_image}:${var.casualos_version}"
      name  = "casualos"

      port {
        name = "frontend"
        container_port = 3000
      }

      port {
        name = "auth"
        container_port = 3002
      }

      env {
        name = "SERVER_CONFIG"
        value = jsonencode(local.server_config)
      }

      env {
        name = "DATABASE_URL"
        value = var.casualos_database_url
      }

    dynamic "env" {
        for_each = var.casualos_extra_env
        content {
            name  = env.key
            value = env.value
        }
    }

      liveness_probe {
        http_get {
          path = "/api/config"
          port = 3000
        }

        initial_delay_seconds = 3
        period_seconds        = 3
      }

      resources {
        limits = {
          memory = "2Gi"
          cpu = "1"
        }

        requests = {
          memory = "1Gi"
          cpu = "0.5"
        }
      }
    }
  }
}

resource "kubernetes_service" "casualos" {
  metadata {
    name      = "casualos"
    namespace = kubernetes_namespace.prod.metadata[0].name
  }

  spec {
    selector = {
      app = kubernetes_pod.casualos.metadata[0].labels.app
    }

    port {
        port = 3000
        target_port = "frontend"
        name = "frontend"
    }

    port {
        port = 3002
        target_port = "auth"
        name = "auth"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_ingress_v1" "casualos" {
    depends_on = [ kubernetes_manifest.letsencrypt_cluster_issuer ]

    metadata {
      name = "casualos"
      namespace = kubernetes_namespace.prod.metadata[0].name
      annotations = {
        "cert-manager.io/cluster-issuer" = "lets-encrypt"
      }
    }

    spec {
        tls {
            hosts = [
                var.casualos_frontend_domain,
                var.casualos_auth_domain
            ]
            secret_name = "casualos-tls-cert"
        }

        rule {
            host = var.casualos_frontend_domain
            http {
                path {
                    path = "/"
                    path_type = "Prefix"
                    backend {
                      service {
                        name = kubernetes_service.casualos.metadata[0].name
                        port {
                            name = "frontend"
                        }
                      }
                    }
                }
            }
        }

        rule {
            host = var.casualos_auth_domain
            http {
                path {
                    path = "/"
                    path_type = "Prefix"
                    backend {
                      service {
                        name = kubernetes_service.casualos.metadata[0].name
                        port {
                            name = "auth"
                        }
                      }
                    }
                }
            }
        }
    }
}

resource "kubernetes_manifest" "letsencrypt_cluster_issuer" {
    depends_on = [ kubernetes_namespace.prod ]
    manifest = yamldecode(templatefile("${path.module}/config/letsencrypt_cluster_issuer.yaml.tftpl", {
        email = var.lets_encrypt_email
    }))
}