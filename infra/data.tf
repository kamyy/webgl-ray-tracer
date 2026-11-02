# The AWS objects this repo reads but does not own.
#
# The hosted zone and the GitHub OIDC provider are shared by every project in the account, so they are looked up here
# and never created or destroyed by infra/.

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "main" {
  zone_id = var.hosted_zone_id
}

# The account-wide identity provider that lets a GitHub Actions run exchange its OIDC token for AWS credentials.
data "aws_iam_openid_connect_provider" "github" {
  arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}
