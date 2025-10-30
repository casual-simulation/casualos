terraform {
    required_version = ">= 1.10"

    backend "local" {
        path = "dev.tfstate"
    }
}

provider "kubernetes" {
    config_path = "~/.kube/config"
    config_context = "microk8s"
}

resource "kubernetes_namespace" "dev" {
  metadata {
    name = "casualos-dev"
  }
}

# resource "kubernetes_persistent_volume" "minio-data" {
#     metadata {
#         name = "minio-data"
#     }
#     spec {
#         access_modes = ["ReadWriteOnce"]
#         capacity = {
#             storage = "10Gi"
#         }
#         persistent_volume_source {
#             host_path {
#                 path = abspath("${path.module}/../../docker/services/data/s3")
#                 type = "DirectoryOrCreate"
#             }
#         }
#     }
# }

# resource "kubernetes_persistent_volume_claim" "minio-data" {
#     metadata {
#         name = "minio-data-pvc"
#         namespace = kubernetes_namespace.dev.metadata[0].name
#     }
#     spec {
#         access_modes = ["ReadWriteOnce"]
#         resources {
#             requests = {
#                 storage = "10Gi"
#             }
#         }
#         volume_name = kubernetes_persistent_volume.minio-data.metadata[0].name
#     }
# }

locals {
    minio_env = [ for tuple in regexall("(.*?)=(.*)", file("${path.module}/config/minio.env")) : {
        name = tuple[0]
        value = tuple[1]
    } ]
}

# resource "kubernetes_persistent_volume_claim" "minio-data" {
#     metadata {
#       name = "minio-data-pvc"
#       namespace = kubernetes_namespace.dev.metadata[0].name
#     }

#     spec {
#         storage_class_name = "microk8s-hostpath"
#         access_modes = ["ReadWriteOnce"]
#         resources {
#             requests = {
#                 storage = "1Gi"
#             }
#         }
#     }
# }


# resource "kubernetes_pod" "minio" {
#     metadata {
#         name = "minio-pod"
#         namespace = kubernetes_namespace.dev.metadata[0].name
#         labels = {
#             app = "minio"
#         }
#     }

#     spec {
#         restart_policy = "Always"
#         container {
#             name = "minio"
#             image = "minio/minio:latest"
#             command = ["minio", "server", "--console-address", ":9001"]
#             port {
#                 container_port = 9000
#                 host_port = 9000
#             }
#             port {
#                 container_port = 9001
#                 host_port = 9001
#             }

#             dynamic "env" {
#                 for_each = local.minio_env
#                 content {
#                     name  = env.value.name
#                     value = env.value.value
#                 }
#             }
            
#             volume_mount {
#               name = "minio-data"
#               mount_path = "/mnt/data"
#             }
#         }
#         volume {
#             name = "minio-data"
#             host_path {
#               path = "/mnt/minio-data"
#               type = "DirectoryOrCreate"
#             }
#         }
#     }
# }

# resource "kubernetes_service" "minio" {
#     metadata {
#         name      = "minio-service"
#         namespace = kubernetes_namespace.dev.metadata[0].name
#     }

#     spec {
        
        
#     }
# }