locals {
  service_name = "${var.project}-email-listener"
  # ALB target group names are capped at 32 chars; use a short prefix
  tg_prefix = "nauta-el"

  tags = {
    Project   = var.project
    Service   = "email-listener"
    ManagedBy = "terraform"
  }

  environments = {
    production = {
      name                    = local.service_name
      tg_name                 = "${local.tg_prefix}-prod"
      image_tag               = "latest"
      desired_count           = var.prod_desired_count
      cpu                     = 512
      memory                  = 1024
      environment             = "production"
      api_key_arn             = var.api_key_secret_arn_prod
      supabase_url            = "https://dazyccjijdahxyciptkp.supabase.co"
      supabase_secret_key_arn = var.supabase_secret_key_arn_prod
      bedrock_region          = var.bedrock_region
    }
    staging = {
      name                    = "${local.service_name}-staging"
      tg_name                 = "${local.tg_prefix}-staging"
      image_tag               = "staging"
      desired_count           = var.staging_desired_count
      cpu                     = 256
      memory                  = 512
      environment             = "staging"
      api_key_arn             = var.api_key_secret_arn_staging
      supabase_url            = "https://fyfwkjvbcrmjqjysdyqw.supabase.co"
      supabase_secret_key_arn = var.supabase_secret_key_arn_staging
      bedrock_region          = var.bedrock_region
    }
  }
}
