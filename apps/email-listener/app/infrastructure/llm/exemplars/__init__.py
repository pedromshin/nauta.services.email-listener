"""Hand-authored exemplar SpecRoot assets for assembly RAG (D-12).

Each exemplar is a real, schema-valid SpecRoot dict organized per category.
These are quality anchors the generator imitates — never AI-fabricated filler.

Categories: dashboard, profile, pricing, feed, landing.

Exported symbol: EXEMPLAR_ASSETS — a tuple of raw dicts consumed by genui_exemplars.py.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# dashboard — sales KPI dashboard with grid of metric cards + revenue table
# ---------------------------------------------------------------------------

_DASHBOARD_SAAS: dict[str, object] = {
    "v": 1,
    "style_pack_id": "linear-clean",
    "data": {
        "revenue_total": "$128,450",
        "revenue_change": "+12% vs last month",
        "active_users": "3,241",
        "users_change": "+8% vs last month",
        "open_deals": "47",
        "deals_change": "+3 this week",
        "churn_rate": "2.1%",
        "churn_change": "-0.3% vs last month",
        "top_deals": [
            {"account": "Acme Corp", "value": "$24,000", "stage": "Proposal"},
            {"account": "Globex Ltd", "value": "$18,500", "stage": "Negotiation"},
            {"account": "Initech", "value": "$12,750", "stage": "Discovery"},
            {"account": "Umbrella Co", "value": "$9,200", "stage": "Closed Won"},
        ],
    },
    "bindings": {},
    "state": [],
    "root": {
        "type": "stack",
        "direction": "vertical",
        "gap": "lg",
        "children": [
            {
                "type": "text",
                "content": "Sales Dashboard",
                "variant": "heading",
            },
            {
                "type": "grid",
                "cols": 4,
                "gap": "md",
                "children": [
                    {
                        "type": "card",
                        "title": "Total Revenue",
                        "children": [
                            {"type": "text", "content": "$128,450", "variant": "heading"},
                            {"type": "text", "content": "+12% vs last month", "variant": "caption", "muted": True},
                        ],
                    },
                    {
                        "type": "card",
                        "title": "Active Users",
                        "children": [
                            {"type": "text", "content": "3,241", "variant": "heading"},
                            {"type": "text", "content": "+8% vs last month", "variant": "caption", "muted": True},
                        ],
                    },
                    {
                        "type": "card",
                        "title": "Open Deals",
                        "children": [
                            {"type": "text", "content": "47", "variant": "heading"},
                            {"type": "text", "content": "+3 this week", "variant": "caption", "muted": True},
                        ],
                    },
                    {
                        "type": "card",
                        "title": "Churn Rate",
                        "children": [
                            {"type": "text", "content": "2.1%", "variant": "heading"},
                            {"type": "text", "content": "-0.3% vs last month", "variant": "caption", "muted": True},
                        ],
                    },
                ],
            },
            {
                "type": "separator",
                "aria-hidden": True,
                "orientation": "horizontal",
            },
            {
                "type": "text",
                "content": "Top Deals",
                "variant": "label",
            },
            {
                "type": "table",
                "caption": "Current pipeline sorted by deal value",
                "columns": [
                    {"key": "account", "header": "Account"},
                    {"key": "value", "header": "Deal Value"},
                    {"key": "stage", "header": "Stage"},
                ],
                "rows": [
                    {"account": "Acme Corp", "value": "$24,000", "stage": "Proposal"},
                    {"account": "Globex Ltd", "value": "$18,500", "stage": "Negotiation"},
                    {"account": "Initech", "value": "$12,750", "stage": "Discovery"},
                    {"account": "Umbrella Co", "value": "$9,200", "stage": "Closed Won"},
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# profile — contact profile detail with key-value metadata + action buttons
# ---------------------------------------------------------------------------

_PROFILE_CONTACT: dict[str, object] = {
    "v": 1,
    "style_pack_id": "nauta-teal",
    "data": {
        "contact_name": "Sarah Chen",
        "contact_email": "sarah.chen@example.org",
        "contact_title": "Head of Procurement",
        "contact_company": "Meridian Partners",
        "contact_phone": "+1 (415) 555-0182",
        "contact_status": "Active",
        "last_contacted": "2 days ago",
        "notes": "Interested in Q3 expansion. Follow up after budget review.",
    },
    "bindings": {},
    "state": [],
    "root": {
        "type": "stack",
        "direction": "vertical",
        "gap": "lg",
        "children": [
            {
                "type": "stack",
                "direction": "horizontal",
                "gap": "md",
                "children": [
                    {
                        "type": "stack",
                        "direction": "vertical",
                        "gap": "sm",
                        "children": [
                            {"type": "text", "content": "Sarah Chen", "variant": "heading"},
                            {"type": "text", "content": "Head of Procurement", "variant": "body"},
                            {"type": "text", "content": "Meridian Partners", "variant": "caption", "muted": True},
                        ],
                    },
                    {
                        "type": "badge",
                        "label": "Active",
                        "variant": "default",
                    },
                ],
            },
            {
                "type": "separator",
                "aria-hidden": True,
                "orientation": "horizontal",
            },
            {
                "type": "key-value-list",
                "label": "Contact Details",
                "items": [
                    {"key": "Email", "value": "sarah.chen@example.org"},
                    {"key": "Phone", "value": "+1 (415) 555-0182"},
                    {"key": "Last Contacted", "value": "2 days ago"},
                ],
            },
            {
                "type": "card",
                "title": "Notes",
                "children": [
                    {
                        "type": "text",
                        "content": "Interested in Q3 expansion. Follow up after budget review.",
                        "variant": "body",
                    },
                ],
            },
            {
                "type": "stack",
                "direction": "horizontal",
                "gap": "sm",
                "children": [
                    {
                        "type": "button",
                        "label": "Send Email",
                        "aria-label": "Send email to Sarah Chen",
                        "variant": "default",
                        "size": "md",
                    },
                    {
                        "type": "button",
                        "label": "Log Call",
                        "aria-label": "Log a phone call with Sarah Chen",
                        "variant": "outline",
                        "size": "md",
                    },
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# pricing — three-tier pricing cards with CTA buttons
# ---------------------------------------------------------------------------

_PRICING_TIERS: dict[str, object] = {
    "v": 1,
    "style_pack_id": "corporate-saas",
    "data": {
        "starter_price": "$29",
        "starter_period": "per month",
        "growth_price": "$79",
        "growth_period": "per month",
        "enterprise_price": "Custom",
        "enterprise_period": "contact us",
    },
    "bindings": {},
    "state": [],
    "root": {
        "type": "stack",
        "direction": "vertical",
        "gap": "lg",
        "children": [
            {
                "type": "text",
                "content": "Simple, Transparent Pricing",
                "variant": "heading",
            },
            {
                "type": "text",
                "content": "Start free. Scale as you grow. No hidden fees.",
                "variant": "body",
                "muted": True,
            },
            {
                "type": "grid",
                "cols": 3,
                "gap": "lg",
                "children": [
                    {
                        "type": "card",
                        "title": "Starter",
                        "description": "For individuals and small teams just getting started.",
                        "children": [
                            {"type": "text", "content": "$29", "variant": "heading"},
                            {"type": "text", "content": "per month", "variant": "caption", "muted": True},
                            {
                                "type": "key-value-list",
                                "label": "Includes",
                                "items": [
                                    {"key": "Projects", "value": "Up to 5"},
                                    {"key": "Users", "value": "1 seat"},
                                    {"key": "Storage", "value": "5 GB"},
                                    {"key": "Support", "value": "Email"},
                                ],
                            },
                            {
                                "type": "button",
                                "label": "Start Free Trial",
                                "aria-label": "Start a free trial of the Starter plan",
                                "variant": "default",
                                "size": "md",
                            },
                        ],
                    },
                    {
                        "type": "card",
                        "title": "Growth",
                        "description": "For growing teams that need more power and collaboration.",
                        "children": [
                            {"type": "text", "content": "$79", "variant": "heading"},
                            {"type": "text", "content": "per month", "variant": "caption", "muted": True},
                            {
                                "type": "key-value-list",
                                "label": "Includes",
                                "items": [
                                    {"key": "Projects", "value": "Unlimited"},
                                    {"key": "Users", "value": "Up to 25 seats"},
                                    {"key": "Storage", "value": "100 GB"},
                                    {"key": "Support", "value": "Priority"},
                                ],
                            },
                            {
                                "type": "button",
                                "label": "Get Started",
                                "aria-label": "Get started with the Growth plan",
                                "variant": "default",
                                "size": "md",
                            },
                        ],
                    },
                    {
                        "type": "card",
                        "title": "Enterprise",
                        "description": "For large organizations with advanced security and compliance needs.",
                        "children": [
                            {"type": "text", "content": "Custom", "variant": "heading"},
                            {"type": "text", "content": "contact us", "variant": "caption", "muted": True},
                            {
                                "type": "key-value-list",
                                "label": "Includes",
                                "items": [
                                    {"key": "Projects", "value": "Unlimited"},
                                    {"key": "Users", "value": "Unlimited seats"},
                                    {"key": "Storage", "value": "1 TB+"},
                                    {"key": "Support", "value": "Dedicated CSM"},
                                ],
                            },
                            {
                                "type": "button",
                                "label": "Contact Sales",
                                "aria-label": "Contact our sales team for Enterprise pricing",
                                "variant": "outline",
                                "size": "md",
                            },
                        ],
                    },
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# feed — email inbox list with status badges + pagination controls
# ---------------------------------------------------------------------------

_FEED_EMAIL_INBOX: dict[str, object] = {
    "v": 1,
    "style_pack_id": "nauta-teal",
    "data": {
        "inbox_count": "24 messages",
        "unread_count": "7 unread",
        "messages": [
            {
                "id": "msg-1",
                "sender": "Acme Corp",
                "subject": "Re: Q3 proposal review",
                "preview": "Thanks for sending over the revised terms.",
                "status": "Unread",
                "received": "10 min ago",
            },
            {
                "id": "msg-2",
                "sender": "Globex Ltd",
                "subject": "Follow-up: onboarding schedule",
                "preview": "We are ready to proceed with the onboarding session.",
                "status": "Unread",
                "received": "1 hr ago",
            },
            {
                "id": "msg-3",
                "sender": "Meridian Partners",
                "subject": "Budget approval confirmed",
                "preview": "Finance has signed off on the expansion budget.",
                "status": "Read",
                "received": "Yesterday",
            },
        ],
    },
    "bindings": {},
    "state": [],
    "root": {
        "type": "stack",
        "direction": "vertical",
        "gap": "md",
        "children": [
            {
                "type": "stack",
                "direction": "horizontal",
                "gap": "md",
                "children": [
                    {"type": "text", "content": "Inbox", "variant": "heading"},
                    {"type": "badge", "label": "7 unread", "variant": "secondary"},
                ],
            },
            {
                "type": "separator",
                "aria-hidden": True,
                "orientation": "horizontal",
            },
            {
                "type": "table",
                "caption": "Recent email messages sorted by received date",
                "columns": [
                    {"key": "sender", "header": "Sender"},
                    {"key": "subject", "header": "Subject"},
                    {"key": "preview", "header": "Preview"},
                    {"key": "status", "header": "Status"},
                    {"key": "received", "header": "Received"},
                ],
                "rows": [
                    {
                        "sender": "Acme Corp",
                        "subject": "Re: Q3 proposal review",
                        "preview": "Thanks for sending over the revised terms.",
                        "status": "Unread",
                        "received": "10 min ago",
                    },
                    {
                        "sender": "Globex Ltd",
                        "subject": "Follow-up: onboarding schedule",
                        "preview": "We are ready to proceed with the onboarding session.",
                        "status": "Unread",
                        "received": "1 hr ago",
                    },
                    {
                        "sender": "Meridian Partners",
                        "subject": "Budget approval confirmed",
                        "preview": "Finance has signed off on the expansion budget.",
                        "status": "Read",
                        "received": "Yesterday",
                    },
                ],
            },
            {
                "type": "stack",
                "direction": "horizontal",
                "gap": "sm",
                "children": [
                    {
                        "type": "button",
                        "label": "Previous",
                        "aria-label": "Go to previous page of messages",
                        "variant": "outline",
                        "size": "sm",
                        "disabled": True,
                    },
                    {
                        "type": "text",
                        "content": "Page 1 of 8",
                        "variant": "caption",
                        "muted": True,
                    },
                    {
                        "type": "button",
                        "label": "Next",
                        "aria-label": "Go to next page of messages",
                        "variant": "outline",
                        "size": "sm",
                    },
                ],
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# landing — product landing page hero + feature highlights + CTA
# ---------------------------------------------------------------------------

_LANDING_PRODUCT: dict[str, object] = {
    "v": 1,
    "style_pack_id": "warm-editorial",
    "data": {
        "product_name": "Nauta",
        "tagline": "Turn your email into structured intelligence",
        "description": "Nauta reads your business emails, extracts entities, and surfaces insights — automatically.",
        "cta_primary": "Get Early Access",
        "cta_secondary": "See How It Works",
        "feature_1_title": "Smart Extraction",
        "feature_1_body": "Nauta identifies companies, contacts, deals, and dates from every email you receive.",
        "feature_2_title": "Unified Timeline",
        "feature_2_body": "See every interaction with a contact or company in a single, searchable timeline.",
        "feature_3_title": "No CRM Required",
        "feature_3_body": "Works alongside your existing tools. No migrations. No overhead.",
    },
    "bindings": {},
    "state": [],
    "root": {
        "type": "stack",
        "direction": "vertical",
        "gap": "lg",
        "children": [
            {
                "type": "stack",
                "direction": "vertical",
                "gap": "md",
                "children": [
                    {
                        "type": "text",
                        "content": "Turn your email into structured intelligence",
                        "variant": "heading",
                    },
                    {
                        "type": "text",
                        "content": "Nauta reads your business emails, extracts entities, and surfaces insights — automatically.",
                        "variant": "body",
                        "muted": True,
                    },
                    {
                        "type": "stack",
                        "direction": "horizontal",
                        "gap": "sm",
                        "children": [
                            {
                                "type": "button",
                                "label": "Get Early Access",
                                "aria-label": "Sign up for early access to Nauta",
                                "variant": "default",
                                "size": "lg",
                            },
                            {
                                "type": "button",
                                "label": "See How It Works",
                                "aria-label": "Watch a demo of how Nauta works",
                                "variant": "outline",
                                "size": "lg",
                            },
                        ],
                    },
                ],
            },
            {
                "type": "separator",
                "aria-hidden": True,
                "orientation": "horizontal",
            },
            {
                "type": "text",
                "content": "Everything you need. Nothing you don't.",
                "variant": "label",
            },
            {
                "type": "grid",
                "cols": 3,
                "gap": "md",
                "children": [
                    {
                        "type": "card",
                        "title": "Smart Extraction",
                        "description": "Nauta identifies companies, contacts, deals, and dates from every email you receive.",
                        "children": [],
                    },
                    {
                        "type": "card",
                        "title": "Unified Timeline",
                        "description": "See every interaction with a contact or company in a single, searchable timeline.",
                        "children": [],
                    },
                    {
                        "type": "card",
                        "title": "No CRM Required",
                        "description": "Works alongside your existing tools. No migrations. No overhead.",
                        "children": [],
                    },
                ],
            },
            {
                "type": "alert",
                "title": "Now in private beta",
                "description": "We are onboarding a limited number of teams this quarter. Request access today.",
                "variant": "default",
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# Public export
# ---------------------------------------------------------------------------

EXEMPLAR_ASSETS: tuple[dict[str, object], ...] = (
    _DASHBOARD_SAAS,
    _PROFILE_CONTACT,
    _PRICING_TIERS,
    _FEED_EMAIL_INBOX,
    _LANDING_PRODUCT,
)

__all__ = ["EXEMPLAR_ASSETS"]
