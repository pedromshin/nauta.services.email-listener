# ECR repository for the email-listener container image.
# Single repo, :latest (production) + :staging tags.

resource "aws_ecr_repository" "email_listener" {
  name                 = local.service_name
  image_tag_mutability = "MUTABLE" # allow :latest / :staging overwrite
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "email_listener" {
  repository = aws_ecr_repository.email_listener.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}
