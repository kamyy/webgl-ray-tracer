# The values to read after an apply.
#
# `terraform output` prints them. `deploy_role_arn` is what the AWS_DEPLOY_ROLE_ARN GitHub secret must hold.

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution in front of the site bucket."
  value       = aws_cloudfront_distribution.site.id
}

output "site_bucket" {
  description = "Name of the S3 bucket that holds the built app."
  value       = aws_s3_bucket.site.id
}

output "scenes_bucket" {
  description = "Name of the private S3 bucket that holds the example scenes."
  value       = aws_s3_bucket.scenes.id
}

output "deploy_role_arn" {
  description = "ARN to store in the AWS_DEPLOY_ROLE_ARN GitHub secret."
  value       = aws_iam_role.deploy.arn
}
