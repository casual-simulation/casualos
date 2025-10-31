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

provider "helm" {
    kubernetes = {
        config_path = "~/.kube/config"
        config_context = "microk8s"
    }

    repository_config_path = "${path.module}/.helm/repositories.yaml"
    repository_cache = "${path.module}/.helm/cache"
}

variable "minio_image" {
    type = string
    default = "quay.io/minio/minio"
}

variable "minio_tag" {
    type = string
    default = "RELEASE.2025-04-08T15-41-24Z"
}

variable "valkey_image" {
    type = string
    default = "valkey/valkey"
}

variable "valkey_tag" {
    type = string
    default = "9.0.0"
}

resource "kubernetes_namespace" "dev" {
  metadata {
    name = "casualos-dev"
  }
}

resource "kubernetes_pod" "minio_pod" {
    metadata {
        name = "minio"
        namespace = resource.kubernetes_namespace.dev.metadata[0].name
        labels = {
            app = "minio"
        }
    }

    spec {
        container {
            name = "minio"
            image = "${var.minio_image}:${var.minio_tag}"
            args = ["server", "--console-address", ":9001"]
            port {
                container_port = 9000
            }
            port {
                container_port = 9001
            }
            env {
                name  = "MINIO_ROOT_USER"
                value = "minioadmin"
            }
            env {
                name  = "MINIO_ROOT_PASSWORD"
                value = "minioadmin"
            }
            env {
                name = "MINIO_VOLUMES"
                value = "/mnt/data"
            }
            volume_mount {
                name       = "minio-data"
                mount_path = "/mnt/data"
            }
        }
        volume {
            name = "minio-data"
            host_path {
                type = "DirectoryOrCreate"
                path = "/minio"
            }
        }

        restart_policy = "Always"
    }
}

resource "kubernetes_pod" "valkey" {
    metadata {
        name = "valkey"
        namespace = resource.kubernetes_namespace.dev.metadata[0].name
        labels = {
            app = "valkey"
        }
    }

    spec {
        container {
            name = "valkey"
            image = "${var.valkey_image}:${var.valkey_tag}"
            args = ["--save 60 1", "--loglevel warning"]
            port {
                name = "valkey"
                container_port = 6379
            }

            volume_mount {
                name = "valkey-data"
                mount_path = "/data"
            }
        }

        volume {
            name = "valkey-data"
            host_path {
                type = "DirectoryOrCreate"
                path = "/valkey"
            }
        }

        restart_policy = "Always"
    }
}

resource "kubernetes_config_map" "livekit_config" {
    metadata {
        name = "livekit-config"
        namespace = resource.kubernetes_namespace.dev.metadata[0].name
    }

    data = {
        "config.yaml" = file("${path.module}/config/livekit.yaml")
    }
}

resource "kubernetes_pod" "livekit" {
    metadata {
        name = "livekit"
        namespace = resource.kubernetes_namespace.dev.metadata[0].name
        labels = {
            app = "livekit"
        }
    }

    spec {
        container {
            name = "livekit"
            image = "livekit/livekit-server:v1.8.0"
            args = [ "--config", "/etc/livekit/config.yaml" ]
            port {
                name = "livekit"
                container_port = 7880
            }

            port {
                name = "livekit-tcp"
                container_port = 7881
            }

            port {
                name = "livekit-udp"
                container_port = 7882
                protocol = "UDP"
            }

            volume_mount {
              name = "config"
              mount_path = "/etc/livekit"
            }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.livekit_config.metadata[0].name
          }
        }

        restart_policy = "Always"
    }
}

resource "kubernetes_pod" "typesense" {
    metadata {
        name = "typesense"
        namespace = resource.kubernetes_namespace.dev.metadata[0].name
        labels = {
            app = "typesense"
        }
    }

    spec {
        container {
            name  = "typesense"
            image = "typesense/typesense:29.0"
            args = ["--data-dir=/data", "--api-key=xyz", "--enable-cors"]

            port {
                name = "typesense"
                container_port = 8108
            }

            volume_mount {
              name = "typesense-data"
              mount_path = "/data"
            }
        }

        volume {
          name = "typesense-data"
          host_path {
            path = "/typesense"
            type = "DirectoryOrCreate"
          }
        }

        restart_policy = "Always"
    }
}

# resource "kubernetes_service" "minio_service" {
#     metadata {
#         name      = "minio-service"
#         namespace = resource.kubernetes_namespace.dev.metadata[0].name
#         labels = {
#             app = "minio"
#         }
#     }

#     spec {
#         selector = {
#             app = kubernetes_pod.minio_pod.metadata[0].labels.app
#         }
#         port {
#             port        = 9000
#             target_port = 9000
#             protocol    = "TCP"
#             name        = "minio"
#         }
#         port {
#             port        = 9001
#             target_port = 9001
#             protocol    = "TCP"
#             name        = "minio-console"
#         }
#         type = "NodePort"
#     }
# }

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