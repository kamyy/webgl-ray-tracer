#!/usr/bin/env bash
# Creates the AWS objects that Terraform needs before it can run: the state bucket and the Terraform role.
#
# Terraform cannot create the S3 bucket that stores its own state, or the IAM role the `apply` job in
# .github/workflows/terraform.yml runs as. This script creates both, then stores the role's ARN in the
# AWS_TERRAFORM_ROLE_ARN GitHub secret. Run it once with admin AWS credentials and an authenticated `gh`. Running it
# again is safe: it only creates what is missing and rewrites the role's policies from the two JSON files in
# infra/bootstrap/.

set -euo pipefail

account_id=570846794821
region=us-west-2
repo=kamyy/webgl-ray-tracer
state_bucket=webgl-ray-tracer-tfstate-${account_id}
role_name=github-actions-webgl-ray-tracer-terraform
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# The policy files in infra/bootstrap/ name this account's ARNs, so a run against another account would grant the wrong
# thing.
current_account=$(aws sts get-caller-identity --query Account --output text)
if [[ "$current_account" != "$account_id" ]]; then
  echo "Signed in to account $current_account, expected $account_id." >&2
  exit 1
fi

# --- State bucket ---------------------------------------------------------------------
if aws s3api head-bucket --bucket "$state_bucket" 2>/dev/null; then
  echo "State bucket $state_bucket exists."
else
  echo "Creating state bucket $state_bucket."
  aws s3api create-bucket --bucket "$state_bucket" --region "$region" \
    --create-bucket-configuration "LocationConstraint=$region" >/dev/null
fi

# These calls overwrite the setting, so they also repair a bucket changed by hand.
aws s3api put-bucket-versioning --bucket "$state_bucket" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$state_bucket" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$state_bucket" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# --- Terraform role -------------------------------------------------------------------
if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
  echo "Updating role $role_name."
  aws iam update-assume-role-policy --role-name "$role_name" --policy-document "file://$here/trust-policy.json"
else
  echo "Creating role $role_name."
  aws iam create-role --role-name "$role_name" --assume-role-policy-document "file://$here/trust-policy.json" >/dev/null
fi

aws iam put-role-policy --role-name "$role_name" --policy-name terraform \
  --policy-document "file://$here/permissions-policy.json"

# --- GitHub secret --------------------------------------------------------------------
role_arn=$(aws iam get-role --role-name "$role_name" --query Role.Arn --output text)
gh secret set AWS_TERRAFORM_ROLE_ARN --repo "$repo" --body "$role_arn"

echo "Done. Role: $role_arn"
