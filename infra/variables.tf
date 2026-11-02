# The inputs to infra/ (every ID that belongs to one AWS account) and the values to read after an apply.
#
# The values are in infra/terraform.tfvars, which Terraform loads on its own. None of them is a secret. Each variable
# has a validation block, so a malformed value fails before Terraform reaches AWS.
#
# `deploy_role_arn` is what the AWS_DEPLOY_ROLE_ARN GitHub secret must hold.

# --- Inputs ---------------------------------------------------------------------------

variable "domain_zone_name" {
  description = "Public DNS zone the site's hostname sits under. The site is served at webgl-ray-tracer.<this>."
  type        = string

  # Catches a value pasted with a scheme, a trailing dot, or a path. It checks shape only, not that a zone exists.
  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.domain_zone_name))
    error_message = "domain_zone_name must be a bare DNS zone name like example.com, with no scheme, trailing dot, or path."
  }
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone id for var.domain_zone_name. Only records are added here; the zone is never created or destroyed."
  type        = string

  # Catches the /hostedzone/-prefixed form the Route 53 API returns.
  validation {
    condition     = can(regex("^Z[0-9A-Z]+$", var.hosted_zone_id))
    error_message = "hosted_zone_id must be a bare Route 53 zone ID like Z0123456789ABCDEFGHIJ, without the /hostedzone/ prefix."
  }
}

variable "github_repo" {
  description = "GitHub repository, as owner/name, whose main branch may assume the deploy role."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$", var.github_repo))
    error_message = "github_repo must look like owner/name."
  }
}

# --- Outputs --------------------------------------------------------------------------

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution in front of the site bucket."
  value       = aws_cloudfront_distribution.site.id
}

output "site_bucket" {
  description = "Name of the S3 bucket that holds the built app."
  value       = aws_s3_bucket.site.id
}

output "deploy_role_arn" {
  description = "ARN to store in the AWS_DEPLOY_ROLE_ARN GitHub secret."
  value       = aws_iam_role.deploy.arn
}
