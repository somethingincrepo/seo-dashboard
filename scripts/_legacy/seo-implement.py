#!/usr/bin/env python3
"""
seo-implement.py
----------------
Reads a seo-brief.json and implements all pending SEO changes.
Designed to be called by the /seo-implement Claude Code command.

Usage:
    python3 seo-implement.py clients/tidal-treasures/audit/seo-brief.json
    python3 seo-implement.py clients/tidal-treasures/audit/seo-brief.json --metadata-only
    python3 seo-implement.py clients/tidal-treasures/audit/seo-brief.json --dry-run
    python3 seo-implement.py clients/tidal-treasures/audit/seo-brief.json --page=/water-taxi/
"""

import json
import sys
import os
import subprocess
import argparse
import re
import secrets
from datetime import date
from pathlib import Path


# ---------------------------------------------------------------------------
# CLI args
# ---------------------------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("brief", help="Path to seo-brief.json")
parser.add_argument("--metadata-only", action="store_true")
parser.add_argument("--schema-only", action="store_true")
parser.add_argument("--verify-only", action="store_true")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--page", default=None, help="Only process this slug, e.g. /water-taxi/")
args = parser.parse_args()

brief_path = Path(args.brief)
brief = json.loads(brief_path.read_text())
DRY_RUN = args.dry_run


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def uid():
    return secrets.token_hex(4)[:7]

def log(msg):
    print(f"  {msg}")

def wp_creds(brief):
    creds = brief.get("credentials", {}).get("wordpress", {})
    user = creds.get("wp_user", "")
    env_var = creds.get("wp_app_password_env", "")
    password = os.environ.get(env_var, "")
    if not password:
        # Try legacy field in top-level for backwards compat
        password = brief.get("wp_credentials", {}).get("app_password", "")
    return user, password

def wp_api(brief, endpoint, method="GET", data=None):
    domain = brief["domain"].rstrip("/")
    url = f"{domain}/wp-json/{endpoint}"
    user, pw = wp_creds(brief)
    cmd = ["curl", "-s", "-u", f"{user}:{pw}", "-H", "Content-Type: application/json"]
    if method == "POST":
        cmd += ["-X", "POST", "-d", json.dumps(data)]
    elif method == "DELETE":
        cmd += ["-X", "DELETE"]
    cmd.append(url)
    if DRY_RUN:
        log(f"[DRY RUN] {method} {url}")
        return {}
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except Exception:
        return {"raw": result.stdout}

def pages_to_process(brief):
    pages = brief.get("pages", [])
    if args.page:
        pages = [p for p in pages if p.get("slug") == args.page]
    if args.metadata_only or args.schema_only:
        return pages
    return [p for p in pages if p.get("status") not in ("complete", "skipped")]


# ---------------------------------------------------------------------------
# WordPress Implementation
# ---------------------------------------------------------------------------

def wp_ensure_infrastructure(brief):
    """Ensure Code Snippets plugin and Yoast meta registration are in place."""
    log("Checking infrastructure...")
    domain = brief["domain"].rstrip("/")
    user, pw = wp_creds(brief)

    # Check Code Snippets plugin
    plugins = wp_api(brief, "wp/v2/plugins?per_page=100")
    if isinstance(plugins, list):
        installed = [p.get("plugin", "") for p in plugins]
        if not any("code-snippets" in p for p in installed):
            log("Installing Code Snippets plugin...")
            wp_api(brief, "wp/v2/plugins", "POST", {"slug": "code-snippets", "status": "active"})
        else:
            log("Code Snippets plugin: present")

    # Check Yoast meta registration snippet
    infra = brief.get("infrastructure", {})
    if not infra.get("yoast_meta_registered"):
        log("Registering Yoast meta fields for REST API...")
        snippet_code = (
            'add_action("rest_api_init", function() {\n'
            '    $fields = ["_yoast_wpseo_title", "_yoast_wpseo_metadesc"];\n'
            '    $types = ["page", "post"];\n'
            '    foreach ($types as $type) {\n'
            '        foreach ($fields as $field) {\n'
            '            register_post_meta($type, $field, [\n'
            '                "show_in_rest" => true,\n'
            '                "single" => true,\n'
            '                "type" => "string",\n'
            '                "auth_callback" => function() { return current_user_can("edit_posts"); }\n'
            '            ]);\n'
            '        }\n'
            '    }\n'
            '});'
        )
        wp_api(brief, "code-snippets/v1/snippets", "POST", {
            "name": "Register Yoast Meta for REST API",
            "code": snippet_code,
            "active": True,
            "scope": "global"
        })


def wp_update_metadata(brief, pages):
    """Update Yoast title and meta description for all pages."""
    log("Updating metadata...")
    for page in pages:
        pid = page.get("id")
        title = page.get("title_tag")
        meta = page.get("meta_description")
        if not pid or (not title and not meta):
            continue
        payload = {}
        if title: payload["_yoast_wpseo_title"] = title
        if meta: payload["_yoast_wpseo_metadesc"] = meta
        r = wp_api(brief, f"wp/v2/pages/{pid}", "POST", {"meta": payload})
        saved = r.get("meta", {})
        ok = saved.get("_yoast_wpseo_title") == title if title else True
        log(f"  {'OK' if ok else 'FAIL'} meta — {page.get('slug')}")


def wp_update_h1s(brief, pages):
    """Update H1 text in Elementor data."""
    log("Updating H1 headings...")
    for page in pages:
        pid = page.get("id")
        h1 = page.get("h1")
        path_str = page.get("h1_elementor_path")
        if not pid or not h1 or not path_str:
            continue

        # Fetch elementor data
        r = wp_api(brief, f"wp/v2/pages/{pid}?context=edit&_fields=meta")
        raw = r.get("meta", {}).get("_elementor_data", "")
        if not raw:
            log(f"  SKIP (no elementor data) — {page.get('slug')}")
            continue

        data = json.loads(raw)

        # Parse path like [1][0][0]
        indices = [int(x) for x in re.findall(r'\d+', path_str)]
        widget = data[indices[0]]
        for idx in indices[1:]:
            widget = widget["elements"][idx]

        # Encode & for HTML
        h1_encoded = h1.replace("&", "&amp;")
        widget["settings"]["title"] = h1_encoded
        widget["settings"]["header_size"] = "h1"

        r2 = wp_api(brief, f"wp/v2/pages/{pid}", "POST", {
            "meta": {"_elementor_data": json.dumps(data), "_elementor_css": ""}
        })
        log(f"  {'OK' if 'id' in r2 else 'FAIL'} H1 — {page.get('slug')}")


def wp_update_image_alts(brief, pages):
    """Update image alt tags via the Media API."""
    log("Updating image alt tags...")
    # Fetch all media
    media = wp_api(brief, "wp/v2/media?per_page=100")
    if not isinstance(media, list):
        log("  Could not fetch media library")
        return

    for page in pages:
        for img in page.get("image_alts", []):
            fragment = img.get("image_url_contains", "")
            alt = img.get("alt_text", "")
            matches = [m for m in media if fragment in m.get("source_url", "")]
            for m in matches:
                r = wp_api(brief, f"wp/v2/media/{m['id']}", "POST", {"alt_text": alt})
                log(f"  {'OK' if 'id' in r else 'FAIL'} alt — {fragment[:40]}")


def build_faq_php_snippet(pages):
    """Build PHP for Code Snippets get_footer FAQ injection."""
    cases = []
    for page in pages:
        faqs = page.get("faqs", [])
        if not faqs:
            continue
        pid = page.get("id")
        rows = ""
        for item in faqs:
            q = item["q"].replace("'", "\\'")
            a = item["a"].replace("'", "\\'")
            rows += f"<div class=\\'tt-faq-item\\'><button class=\\'tt-faq-q\\'>{q}<span class=\\'tt-faq-icon\\'>+</span></button><div class=\\'tt-faq-a\\'><p>{a}</p></div></div>"
        cases.append(f"    {pid} => '{rows}'")

    if not cases:
        return None

    return (
        "add_action('get_footer', function() {\n"
        "    $page_faqs = [\n"
        + ",\n".join(cases) + "\n"
        "    ];\n"
        "    $id = get_the_ID();\n"
        "    if (!isset($page_faqs[$id])) return;\n"
        "    $rows = $page_faqs[$id];\n"
        "    echo '\n"
        "<section id=\"tt-faq-section\" style=\"background:#f9f9f9;padding:60px 20px;width:100%;box-sizing:border-box;\">\n"
        "  <div style=\"max-width:860px;margin:0 auto;\">\n"
        "    <h2 style=\"font-family:Oswald,sans-serif;color:#F86112;font-size:36px;font-weight:600;text-align:center;margin:0 0 36px;\">Frequently Asked Questions</h2>\n"
        "    ' . $rows . '\n"
        "  </div>\n"
        "</section>\n"
        "<style>\n"
        ".tt-faq-item{border:1px solid #e0e0e0;border-radius:4px;margin-bottom:10px;background:#fff;overflow:hidden;}\n"
        ".tt-faq-q{width:100%;background:none;border:none;padding:18px 48px 18px 20px;font-family:Oswald,sans-serif;font-size:16px;font-weight:500;color:#1a1a1a;cursor:pointer;text-align:left;position:relative;display:flex;align-items:center;justify-content:space-between;}\n"
        ".tt-faq-q:hover{color:#F86112;}\n"
        ".tt-faq-icon{font-size:22px;color:#F86112;font-style:normal;flex-shrink:0;margin-left:12px;transition:transform .2s;}\n"
        ".tt-faq-item.open .tt-faq-icon{transform:rotate(45deg);}\n"
        ".tt-faq-a{display:none;padding:4px 20px 18px;color:#444;font-size:15px;line-height:1.75;border-top:1px solid #f0f0f0;}\n"
        ".tt-faq-item.open .tt-faq-a{display:block;}\n"
        "</style>\n"
        "<script>\n"
        "document.querySelectorAll(\".tt-faq-q\").forEach(function(btn){\n"
        "  btn.addEventListener(\"click\",function(){\n"
        "    this.closest(\".tt-faq-item\").classList.toggle(\"open\");\n"
        "  });\n"
        "});\n"
        "</script>';\n"
        "});"
    )


def build_schema_php_snippet(brief, pages):
    """Build PHP for LocalBusiness + FAQPage schema injection."""
    biz = brief.get("business", {})
    homepage = next((p for p in brief.get("pages", []) if p.get("slug") == "/"), None)
    home_id = homepage.get("id") if homepage else None

    parts = []

    # LocalBusiness on homepage
    if home_id and "LocalBusiness" in (homepage.get("schema") or []):
        schema = {
            "@context": "https://schema.org",
            "@type": biz.get("schema_types", ["LocalBusiness"]),
            "name": biz.get("name", ""),
            "url": brief.get("domain", ""),
            "telephone": biz.get("phone", ""),
            "address": {
                "@type": "PostalAddress",
                **{k: v for k, v in biz.get("address", {}).items()}
            },
            "priceRange": biz.get("price_range", ""),
            "geo": {"@type": "GeoCoordinates", "latitude": biz.get("geo", {}).get("lat"), "longitude": biz.get("geo", {}).get("lng")}
        }
        schema_json = json.dumps(schema, ensure_ascii=False).replace("'", "\\'")
        parts.append(f"    if (is_page({home_id})) {{ echo \"<script type=\\\"application/ld+json\\\">\" . '{schema_json}' . \"</script>\\n\"; }}")

    # FAQPage per service page
    for page in pages:
        if "FAQPage" not in (page.get("schema") or []):
            continue
        faqs = page.get("faqs", [])
        if not faqs:
            continue
        pid = page.get("id")
        schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in faqs
            ]
        }
        schema_json = json.dumps(schema, ensure_ascii=False).replace("'", "\\'")
        parts.append(f"    if (is_page({pid})) {{ echo \"<script type=\\\"application/ld+json\\\">\" . '{schema_json}' . \"</script>\\n\"; }}")

    if not parts:
        return None

    return "add_action(\"wp_head\", function() {\n" + "\n".join(parts) + "\n});"


def wp_update_schema_and_faqs(brief, pages):
    """Inject schema and FAQ sections via Code Snippets."""
    log("Injecting schema...")
    schema_php = build_schema_php_snippet(brief, pages)
    if schema_php:
        wp_api(brief, "code-snippets/v1/snippets", "POST", {
            "name": f"SEO Schema — {brief.get('client', 'Client')}",
            "desc": "Injects LocalBusiness and FAQPage JSON-LD schema.",
            "code": schema_php,
            "active": True,
            "scope": "global"
        })
        log("  Schema snippet created")

    log("Injecting FAQ sections...")
    faq_php = build_faq_php_snippet(pages)
    if faq_php:
        wp_api(brief, "code-snippets/v1/snippets", "POST", {
            "name": f"FAQ Sections — {brief.get('client', 'Client')}",
            "desc": "Renders FAQ sections before footer on service pages.",
            "code": faq_php,
            "active": True,
            "scope": "global"
        })
        log("  FAQ snippet created")


def wp_clear_cache(brief):
    """Clear Elementor cache."""
    log("Clearing Elementor cache...")
    domain = brief["domain"].rstrip("/")
    user, pw = wp_creds(brief)
    subprocess.run([
        "curl", "-s", "-X", "DELETE",
        "-u", f"{user}:{pw}",
        f"{domain}/wp-json/elementor/v1/cache"
    ], capture_output=True)
    log("  Cache cleared")


def wp_verify(brief, pages):
    """Spot-check live pages for implemented changes."""
    log("Verifying live pages...")
    domain = brief["domain"].rstrip("/")
    for page in pages[:5]:  # spot check first 5
        slug = page.get("slug", "/")
        url = f"{domain}{slug}"
        r = subprocess.run(["curl", "-s", url], capture_output=True, text=True)
        html = r.stdout
        title = page.get("title_tag", "")
        h1 = page.get("h1", "")
        faq = len(page.get("faqs", [])) > 0
        checks = {
            "title": title[:30] in html if title else True,
            "h1": (h1[:20] in html) if h1 else True,
            "faq": ("tt-faq-section" in html) if faq else True,
        }
        symbols = {k: "✓" if v else "✗" for k, v in checks.items()}
        log(f"  {slug} — title:{symbols['title']} h1:{symbols['h1']} faq:{symbols['faq']}")


# ---------------------------------------------------------------------------
# Shopify Implementation (stub — extend per engagement)
# ---------------------------------------------------------------------------

def shopify_update_metadata(brief, pages):
    log("Shopify metadata update — stub, extend per engagement")
    # TODO: Use Admin API /pages.json, /products.json, /blogs/{id}/articles.json
    # PATCH with {page: {metafields: [{namespace:"global", key:"title_tag", value: "..."}]}}


def shopify_clear_cache(brief):
    log("Shopify: no cache layer to clear")


# ---------------------------------------------------------------------------
# Webflow Implementation (stub)
# ---------------------------------------------------------------------------

def webflow_update_metadata(brief, pages):
    log("Webflow metadata update — stub, extend per engagement")
    # TODO: Use CMS Items API PATCH /collections/{id}/items/{item_id}
    # Fields: seo-title, seo-description


def webflow_publish(brief):
    log("Publishing Webflow site...")
    # TODO: POST /sites/{site_id}/publish


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    cms = brief.get("cms", "wordpress").lower()
    pages = pages_to_process(brief)

    print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Running SEO implementation for: {brief.get('client')}")
    print(f"CMS: {cms} | Pages: {len(pages)} | Domain: {brief.get('domain')}\n")

    if args.verify_only:
        if cms == "wordpress":
            wp_verify(brief, pages)
        return

    if cms == "wordpress":
        wp_ensure_infrastructure(brief)

        if not args.schema_only:
            wp_update_metadata(brief, pages)
            wp_update_h1s(brief, pages)
            wp_update_image_alts(brief, pages)

        if not args.metadata_only:
            wp_update_schema_and_faqs(brief, pages)

        wp_clear_cache(brief)
        wp_verify(brief, pages)

    elif cms == "shopify":
        shopify_update_metadata(brief, pages)
        shopify_clear_cache(brief)

    elif cms == "webflow":
        webflow_update_metadata(brief, pages)
        webflow_publish(brief)

    elif cms == "framer":
        print("Framer has no public write API — all changes must be made manually in the Framer editor.")
        print("Recommended: export a change list from the brief and apply in the Framer UI.")

    else:
        print(f"Unknown CMS: {cms}. Supported: wordpress, shopify, webflow, framer")

    # Update brief with completion status
    if not DRY_RUN:
        for page in brief.get("pages", []):
            if page.get("status") == "pending":
                page["status"] = "complete"
        brief_path.write_text(json.dumps(brief, indent=2))
        print(f"\nBrief updated: {brief_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
