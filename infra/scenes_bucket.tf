# The private S3 bucket that holds the example glTF scenes.
#
# The scenes are large binaries, so they are kept out of git. CloudFront serves them at /scenes/* through an Origin
# Access Control, and the bucket policy lets only the distribution in infra/cloudfront.tf read them. The `deploy` job in
# .github/workflows/ci.yml has no access to this bucket, so a deploy can never delete a scene. The scenes are uploaded
# by hand with the AWS CLI (RUNBOOK.md).

resource "aws_s3_bucket" "scenes" {
  bucket = "${local.hostname}-scenes"
}

# Keeps the previous copy of a scene when a file is overwritten by mistake.
resource "aws_s3_bucket_versioning" "scenes" {
  bucket = aws_s3_bucket.scenes.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Versioning keeps every overwritten or deleted copy, and scenes are large. This removes the old copies after 30 days.
resource "aws_s3_bucket_lifecycle_configuration" "scenes" {
  bucket = aws_s3_bucket.scenes.id

  # The versioning resource must exist first, because S3 rejects noncurrent-version rules on an unversioned bucket.
  depends_on = [aws_s3_bucket_versioning.scenes]

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "scenes" {
  bucket = aws_s3_bucket.scenes.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "scenes" {
  bucket = aws_s3_bucket.scenes.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allows reads from CloudFront's service principal only, and only for requests that come from this distribution.
resource "aws_s3_bucket_policy" "scenes" {
  bucket = aws_s3_bucket.scenes.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.scenes.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      },
    ]
  })
}
