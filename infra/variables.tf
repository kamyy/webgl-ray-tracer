# The inputs to infra/: every ID that belongs to one AWS account.
#
# The values are in infra/terraform.tfvars, which Terraform loads on its own. None of them is a secret. Each variable
# has a validation block, so a malformed value fails before Terraform reaches AWS.

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
