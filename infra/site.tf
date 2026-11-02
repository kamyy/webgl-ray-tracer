# Where the built app is served from: the S3 bucket, the CloudFront distribution in front of it, the DNS record and
# the HTTPS certificate.
#
# The `deploy` job in .github/workflows/ci.yml syncs dist/ into the bucket.
# Visitors reach the app through CloudFront, which serves the bucket's files over HTTPS and caches them for up to 24
# hours. The bucket is private. CloudFront reads it through an Origin Access Control, which signs each request, and the
# bucket policy lets only this distribution read.

locals {
  hostname = "webgl-ray-tracer.${var.domain_zone_name}"
}

# --- Bucket ---------------------------------------------------------------------------
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

# --- CloudFront -----------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = local.hostname
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  comment             = "WebGL Ray Tracer"
  enabled             = true
  aliases             = [local.hostname]
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2"
  is_ipv6_enabled     = true

  origin {
    origin_id = "S3-${local.hostname}"
    # The regional name sends requests straight to the bucket's region. The global name redirects at first, which an
    # Origin Access Control cannot follow.
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "S3-${local.hostname}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2018"
  }
}

# --- DNS ------------------------------------------------------------------------------
resource "aws_route53_record" "site" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.hostname
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.site.domain_name]
}

# --- Certificate ----------------------------------------------------------------------

# CloudFront serves the app over HTTPS with an AWS Certificate Manager (ACM) certificate for webgl-ray-tracer.orky.net
# alone. CloudFront only reads certificates from us-east-1, so this one is created there with the aws.us_east_1
# provider. ACM issues it once the validation CNAME exists in the hosted zone, and renews it automatically for as long as
# that CNAME stays. Deleting the record makes the renewal fail, and the certificate then expires.

resource "aws_acm_certificate" "site" {
  provider = aws.us_east_1

  domain_name       = local.hostname
  validation_method = "DNS"

  # A replacement certificate is created and attached before the old one is destroyed, so the site never loses HTTPS.
  lifecycle {
    create_before_destroy = true
  }
}

# One record per domain name on the certificate. There is only one, but for_each keys it by name, which is known at plan
# time even though the record's name and value are only known after apply.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for option in aws_acm_certificate.site.domain_validation_options : option.domain_name => option
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  ttl     = 300
  records = [each.value.resource_record_value]
}

# Waits until ACM has validated the certificate, so the distribution is never created with an unissued one.
resource "aws_acm_certificate_validation" "site" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
