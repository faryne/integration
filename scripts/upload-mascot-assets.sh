#!/usr/bin/env bash
set -euo pipefail

# 將已確認的看板娘網站素材上傳至共用 S3 bucket，並逐一確認物件存在。
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 僅解析指定欄位，不執行 .env 內容，也不在輸出中顯示憑證。
read_env() {
  local value
  value="$(rg -m 1 "^$1=" "$root_dir/.env")"
  value="${value#*=}"
  value="${value#\"}"
  printf '%s' "${value%\"}"
}

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(read_env S3_ACCESS_KEY)}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(read_env S3_SECRET_KEY)}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$(read_env S3_REGION)}"
S3_BUCKET="${S3_BUCKET:-$(read_env S3_BUCKET)}"
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}'

upload_group() {
  local source_dir="$1" key_prefix="$2" content_type="$3" file key
  for file in "$source_dir"/*; do
    key="mascot_assets/$key_prefix/${file##*/}"
    aws s3 cp "$file" "s3://$S3_BUCKET/$key" \
      --content-type "$content_type" \
      --cache-control "public, max-age=86400"
    aws s3api head-object --bucket "$S3_BUCKET" --key "$key" --query '{Size:ContentLength,Type:ContentType}'
  done
}

case "${1:-all}" in
  all)
    upload_group "$root_dir/DevelopDocuments/mascot/footer-sd/exports" "footer-sd" "image/png"
    upload_group "$root_dir/DevelopDocuments/mascot/site-icons/exports" "site-icons" "image/webp"
    upload_group "$root_dir/DevelopDocuments/mascot/error-page/exports" "error-page" "image/png"
    ;;
  error-page)
    upload_group "$root_dir/DevelopDocuments/mascot/error-page/exports" "error-page" "image/png"
    ;;
  *)
    echo "Usage: $0 [all|error-page]" >&2
    exit 2
    ;;
esac
