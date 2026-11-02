# The private S3 bucket that holds the built app.
#
# The `deploy` job in .github/workflows/ci.yml syncs dist/ into this bucket. The bucket is private. CloudFront reads it
# through an Origin Access Control, which signs each request, and the bucket policy lets only the distribution in
# infra/cloudfront.tf read.

resource "aws_s3_bucket" "site" {
  bucket = local.hostname
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allows reads from CloudFront's service principal only, and only for requests that come from this distribution. S3 does
# not treat that as a public policy, so the public access block above can stay fully on.
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      },
    ]
  })
}
