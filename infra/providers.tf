# Terraform's own settings: the required versions, the AWS provider, and the state backend.
#
# Pins the Terraform CLI and AWS provider versions. Configures one AWS provider for us-west-2, where the S3 bucket
# lives, and one for us-east-1. Stores Terraform's state in a dedicated S3 bucket. Tags every AWS resource the providers
# create with the project name. The state bucket is created by hand once, because Terraform can't store state in a
# bucket it hasn't made yet (RUNBOOK.md).

terraform {
  # Exact, not a floor. A range would let a newer local CLI plan. .github/workflows/terraform.yml reads this string to
  # install the same version.
  required_version = "1.16.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # terraform init -backend-config adds these three arguments to the backend "s3" block:
  #   - bucket = webgl-ray-tracer-tfstate-570846794821
  #   - key    = webgl-ray-tracer.tfstate
  #   - region = us-west-2
  # They are not written in HCL here, so the workflow and a local run pass the same values (RUNBOOK.md).
  backend "s3" {
    # Terraform's native S3 state locking (>= 1.10). No separate DynamoDB table is needed.
    # use_lockfile is not the HCL lockfile infra/.terraform.lock.hcl. That file pins provider versions.
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-west-2"

  default_tags {
    tags = {
      Project = "webgl-ray-tracer"
    }
  }
}

# CloudFront only reads ACM certificates from us-east-1, wherever the rest of the stack runs. See infra/cert.tf.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project = "webgl-ray-tracer"
    }
  }
}
