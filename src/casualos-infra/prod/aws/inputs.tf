variable "state_passphrase" {
    type = string
    nullable = false
    sensitive = true
}

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

variable "primary_instance_type" {
    type = string
    default = "t3.micro"
}

variable "secondary_instance_type" {
    type = string
    default = "t3.micro"
}

variable "worker_instance_type" {
    type = string
    default = "t3.micro"
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