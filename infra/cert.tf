# The HTTPS certificate for the site, and the DNS record that proves we own the hostname.
#
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
