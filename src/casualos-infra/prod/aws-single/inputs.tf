variable "aws_region" {
    type = string
    default = "us-east-1"
}

variable "aws_availability_zone_primary" {
    type = string
    default = "a"
    description = "The availability zone that the primary instance should be deployed to."
}

variable "project_name" {
    type = string
    default = "casualos"
}

variable "environment" {
    type = string
    default = "prod"
}

variable "customer" {
    type = string
    default = "default"
}

variable "ami_id" {
    type = string
    default = "ami-0ecb62995f68bb549" // Ubuntu Server 24.04 LTS Latest Stable AMD64
}

variable "primary_instance_type" {
    type = string
    default = "t3.medium"
}

variable "casualos_image" {
    type = string
    default = "ghcr.io/casual-simulation/casualos"
}

variable "casualos_version" {
    type = string
    default = "v3.8.1"
}

variable "casualos_server_config" {
    type = any
    description = "The server config to use formatted as JSON."
    sensitive = true
}

variable "casualos_database_url" {
    type = string
    description = "The database URL for CasualOS to connect to."
    sensitive = true
}

variable "casualos_extra_env" {
    type = map(string)
    default = {}
}

variable "files_storage_class" {
    type = string
    default = "STANDARD"
}

variable "lets_encrypt_email" {
    type = string
    description = "The email address to use for Let's Encrypt registration."
}

variable "casualos_frontend_domain" {
    type = string
    description = "The domain name for the CasualOS frontend."
}

variable "casualos_auth_domain" {
    type = string
    description = "The domain name for the CasualOS auth service."
}