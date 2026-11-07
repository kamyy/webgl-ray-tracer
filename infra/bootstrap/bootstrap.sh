#!/usr/bin/env bash
# Creates the AWS objects that Terraform needs before it can run: the state bucket, the GitHub OIDC provider and the
# Terraform role.
#
# Terraform cannot create the S3 bucket that stores its own state, or the IAM role the `apply` job in
# .github/workflows/terraform.yml runs as. This script creates both, plus the account's GitHub OIDC provider when it is
# missing, then stores the values the workflows need in GitHub: the AWS_TERRAFORM_ROLE_ARN and AWS_DEPLOY_ROLE_ARN
# secrets and the TFSTATE_BUCKET and SITE_BUCKET variables. The account comes from the signed-in AWS credentials, the
# repo from `gh`, and the domain and hosted zone from infra/terraform.tfvars. Run it once with admin AWS credentials and
# an authenticated `gh`. Running it again is safe: it only creates what is missing and rewrites the role's policies from
# the two JSON files in infra/bootstrap/.

set -euo pipefail

# Newer AWS CLI versions print a result for `head-bucket`, and a pager would hold the script until the user quits it.
export AWS_PAGER=""

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tfvars="$here/../terraform.tfvars"
region=us-west-2
role_name=github-actions-webgl-ray-tracer-terraform
oidc_url=token.actions.githubusercontent.com

# Prints the quoted value of a key in infra/terraform.tfvars, and stops the script when the key has no value.
tfvar() {
  local value
  value=$(sed -n "s/^$1[[:space:]]*=[[:space:]]*\"\(.*\)\"/\1/p" "$tfvars")
  if [[ -z "$value" ]]; then
    echo "No \"$1\" value in infra/terraform.tfvars." >&2
    exit 1
  fi
  echo "$value"
}

account_id=$(aws sts get-caller-identity --query Account --output text)
repo=$(tfvar github_repo)
domain_zone_name=$(tfvar domain_zone_name)
hosted_zone_id=$(tfvar hosted_zone_id)
state_bucket=webgl-ray-tracer-tfstate-${account_id}
site_bucket=webgl-ray-tracer.${domain_zone_name}
scenes_bucket=${site_bucket}-scenes
deploy_role_arn=arn:aws:iam::${account_id}:role/github-actions-webgl-ray-tracer-deploy

# The secrets and variables are written to the repo that `gh` resolves, which must be the repo the trust policy names.
gh_repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
if [[ "$gh_repo" != "$repo" ]]; then
  echo "infra/terraform.tfvars says github_repo is $repo, but gh resolves $gh_repo." >&2
  exit 1
fi

echo "Account $account_id, repo $repo, site bucket $site_bucket."

# --- Policy files ---------------------------------------------------------------------
# The files in infra/bootstrap/ hold placeholders, so the same files work in any account.
rendered=$(mktemp -d)
trap 'rm -rf "$rendered"' EXIT
for file in trust-policy.json permissions-policy.json; do
  sed -e "s|__ACCOUNT_ID__|$account_id|g" \
    -e "s|__REPO__|$repo|g" \
    -e "s|__HOSTED_ZONE_ID__|$hosted_zone_id|g" \
    -e "s|__HOSTNAME__|$site_bucket|g" \
    -e "s|__SCENES_BUCKET__|$scenes_bucket|g" \
    "$here/$file" >"$rendered/$file"

  # A placeholder the sed call above doesn't know about would reach IAM as literal text.
  if grep -q '__[A-Z_]*__' "$rendered/$file"; then
    echo "$file still has an unreplaced placeholder." >&2
    exit 1
  fi
done

# --- State bucket ---------------------------------------------------------------------
if aws s3api head-bucket --bucket "$state_bucket" >/dev/null 2>&1; then
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

# --- GitHub OIDC provider -------------------------------------------------------------
# One provider per account lets every GitHub Actions run exchange its token for AWS credentials. infra/ only looks it up.
if aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "arn:aws:iam::${account_id}:oidc-provider/${oidc_url}" >/dev/null 2>&1; then
  echo "OIDC provider $oidc_url exists."
else
  echo "Creating OIDC provider $oidc_url."
  aws iam create-open-id-connect-provider --url "https://$oidc_url" --client-id-list sts.amazonaws.com >/dev/null
fi

# --- Terraform role -------------------------------------------------------------------
if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
  echo "Updating role $role_name."
  aws iam update-assume-role-policy --role-name "$role_name" --policy-document "file://$rendered/trust-policy.json"
else
  echo "Creating role $role_name."
  aws iam create-role --role-name "$role_name" --assume-role-policy-document "file://$rendered/trust-policy.json" >/dev/null
fi

aws iam put-role-policy --role-name "$role_name" --policy-name terraform \
  --policy-document "file://$rendered/permissions-policy.json"

# --- GitHub secrets and variables -----------------------------------------------------
# The deploy role is created later by Terraform, under the name that deploy_role_arn spells out.
role_arn=$(aws iam get-role --role-name "$role_name" --query Role.Arn --output text)
gh secret set AWS_TERRAFORM_ROLE_ARN --repo "$repo" --body "$role_arn"
gh secret set AWS_DEPLOY_ROLE_ARN --repo "$repo" --body "$deploy_role_arn"
gh variable set TFSTATE_BUCKET --repo "$repo" --body "$state_bucket"
gh variable set SITE_BUCKET --repo "$repo" --body "$site_bucket"

echo "Done. Role: $role_arn"
