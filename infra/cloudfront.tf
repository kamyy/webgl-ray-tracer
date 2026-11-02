# The CloudFront distribution in front of the site bucket, and the DNS record that points the hostname at it.
#
# Visitors reach the app through CloudFront, which serves the bucket's files over HTTPS and caches them for up to 24
# hours. The distribution reads the bucket in infra/bucket.tf and uses the certificate in infra/certificate.tf.
#
# `local.hostname` is the site's address. The bucket, the distribution, the DNS record and the certificate all use it.

locals {
  hostname = "webgl-ray-tracer.${var.domain_zone_name}"
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
