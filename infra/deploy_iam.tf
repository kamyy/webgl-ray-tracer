# The IAM role the `deploy` job in .github/workflows/ci.yml assumes to publish the app.
#
# GitHub Actions exchanges its OIDC token for this role's credentials, so the repo stores no long-lived AWS keys. The
# trust policy accepts only the main branch of var.github_repo. The role can write to the site bucket and nothing else.

resource "aws_iam_role" "deploy" {
  name = "github-actions-webgl-ray-tracer-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
          }
        }
      },
    ]
  })
}

resource "aws_iam_policy" "deploy" {
  name = "webgl-ray-tracer-deploy-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.site.arn, "${aws_s3_bucket.site.arn}/*"]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}
