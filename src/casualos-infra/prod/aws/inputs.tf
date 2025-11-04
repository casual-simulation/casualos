variable "aws_region" {
    type = string
    default = "us-east-1"
}

variable "aws_profile" {
    type = string
    nullable = true
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

variable "secondary_instance_type" {
    type = string
    default = "t3.medium"
}

variable "worker_instance_type" {
    type = string
    default = "t3.medium"
}

variable "min_secondary_nodes" {
    type = number
    default = 0
}

variable "max_secondary_nodes" {
    type = number
    default = 2
}

variable "desired_secondary_nodes" {
    type = number
    default = 0
}

variable "min_worker_nodes" {
    type = number
    default = 0
}

variable "max_worker_nodes" {
    type = number
    default = 2
}

variable "desired_worker_nodes" {
    type = number
    default = 0
}