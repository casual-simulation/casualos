terraform {
    encryption {
        key_provider "pbkdf2" "key" {
            passphrase = var.state_passphrase
            iterations = 600000
            key_length = 32
            salt_length = 32
            hash_function = "sha512"
        }
    }

    backend "s3" {}
}