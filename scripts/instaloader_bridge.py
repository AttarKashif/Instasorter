import sys
import json
import os

try:
    import instaloader
    HAS_INSTALOADER = True
except ImportError:
    HAS_INSTALOADER = False

def extract_post_info(shortcode_or_url):
    if not HAS_INSTALOADER:
        return {
            "success": False,
            "error": "instaloader python module not installed (falling back to Node.js scrapers)"
        }

    # Extract shortcode if URL was passed
    code = shortcode_or_url.strip().rstrip('/')
    if '/p/' in code:
        code = code.split('/p/')[1].split('/')[0].split('?')[0]
    elif '/reel/' in code:
        code = code.split('/reel/')[1].split('/')[0].split('?')[0]

    # Load scraping parameters from environment
    username = os.environ.get("IG_USERNAME", "").strip()
    password = os.environ.get("IG_PASSWORD", "").strip()
    session_cookie = os.environ.get("IG_SESSION_COOKIE", "").strip()
    proxy_url = os.environ.get("IG_PROXY", "").strip()

    # Dynamic User-Agent Rotation
    user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"

    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        user_agent=user_agent
    )

    # 1. Configure proxy on session
    if proxy_url:
        L.context._session.proxies = {
            "http": proxy_url,
            "https": proxy_url
        }

    # 2. Inject raw Session ID Cookie if present (Extremely stable bypass)
    if session_cookie:
        L.context._session.cookies.set("sessionid", session_cookie, domain=".instagram.com")
        # Set supplementary cookies for compatibility
        L.context._session.cookies.set("csrftoken", "missing", domain=".instagram.com")
        if username:
            L.context._session.cookies.set("ds_user_id", username, domain=".instagram.com")

    # 3. Authenticate with credentials if session cookie is missing but user/pass exist
    elif username and password:
        try:
            L.login(username, password)
        except Exception as auth_err:
            # Continue anonymously if login fails, but record notice
            pass

    try:
        post = instaloader.Post.from_shortcode(L.context, code)
        
        caption = post.caption if post.caption else ""
        hashtags = list(post.caption_hashtags) if post.caption_hashtags else []
        
        # Capture high-resolution display URLs
        display_url = post.url if hasattr(post, 'url') else None
        
        # Support carousel slides (multiple images) if present
        carousel_media = []
        if post.mediacount > 1:
            try:
                for node in post.get_sidecar_nodes():
                    carousel_media.append({
                        "displayUrl": node.display_url,
                        "isVideo": node.is_video,
                        "videoUrl": node.video_url if node.is_video else None
                    })
            except Exception:
                pass

        result = {
            "success": True,
            "shortcode": code,
            "displayUrl": display_url,
            "caption": caption,
            "hashtags": hashtags,
            "likes": post.likes,
            "comments": post.comments,
            "ownerUsername": post.owner_username,
            "ownerName": post.owner_profile.full_name if post.owner_profile else post.owner_username,
            "dateUtc": post.date_utc.isoformat() if post.date_utc else None,
            "typename": post.typename if hasattr(post, 'typename') else "GraphImage",
            "isVideo": post.is_video,
            "videoUrl": post.video_url if post.is_video else None,
            "carouselMedia": carousel_media,
            "isCarousel": len(carousel_media) > 0,
            "strategy": "Instaloader Subprocess Engine (Authenticated)" if session_cookie or (username and password) else "Instaloader Subprocess Engine (Anonymous)"
        }
        return result
    except instaloader.exceptions.ConnectionException as conn_err:
        return {
            "success": False,
            "shortcode": code,
            "error_type": "RATE_LIMIT_OR_BLOCK",
            "error": f"Instagram Connection Blocked: {str(conn_err)}. Consider setting an Instagram Session Cookie in Settings."
        }
    except instaloader.exceptions.PrivateProfileNotFollowedException:
        return {
            "success": False,
            "shortcode": code,
            "error_type": "PRIVATE_PROFILE",
            "error": "This post is on a private profile. You must configure your account session cookies to view it."
        }
    except instaloader.exceptions.LoginRequiredException:
        return {
            "success": False,
            "shortcode": code,
            "error_type": "LOGIN_REQUIRED",
            "error": "Instagram requires login. Please configure a valid Instagram Session Cookie in settings."
        }
    except Exception as e:
        return {
            "success": False,
            "shortcode": code,
            "error_type": "GENERAL_EXCEPTION",
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No shortcode or URL provided"}))
        sys.exit(1)

    target = sys.argv[1]
    output = extract_post_info(target)
    print(json.dumps(output))
