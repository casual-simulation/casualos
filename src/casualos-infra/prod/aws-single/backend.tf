variable "passphrase" {
    type = string
    sensitive = true
}

terraform {
    encryption {
        method "unencrypted" "migrate" {}

        key_provider "pbkdf2" "key" {
            passphrase = var.passphrase
            iterations = 600000
            key_length = 32
            salt_length = 32
            hash_function = "sha512"
        }

        method "aes_gcm" "default" {
            keys = key_provider.pbkdf2.key
        }

        state {
            method = method.aes_gcm.default

            fallback {
                method = method.unencrypted.migrate
            }
        }
    }

    backend "s3" {}
}