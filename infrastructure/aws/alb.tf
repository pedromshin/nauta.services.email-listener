# Shared ALB with host/path-free split: production on port 80 default,
# staging behind a dedicated listener rule on port 8080 until a domain +
# ACM cert is attached (then both move to 443 with host-based routing).

resource "aws_lb" "main" {
  name               = local.service_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = local.tags
}

resource "aws_lb_target_group" "service" {
  for_each = local.environments

  name        = each.value.tg_name
  port        = var.service_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["production"].arn
  }

  tags = local.tags
}

# Port 8080 ingress is defined inline on aws_security_group.alb (network.tf).
# Mixing inline ingress blocks with standalone aws_security_group_rule on the
# same SG causes perpetual drift, so the staging port lives with the others.

resource "aws_lb_listener" "staging" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8080
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["staging"].arn
  }

  tags = local.tags
}
