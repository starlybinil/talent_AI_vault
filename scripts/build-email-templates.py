#!/usr/bin/env python3
"""
Builds the Supabase Auth email templates in supabase/templates/ from one shared layout.

Paste each generated file into Supabase: Authentication -> Emails -> Templates (see README for subjects).
Images are served by the site from public/email/ (https://foundryready.org/email/...); regenerate them with
scripts/render-email-images.mjs. Run:  python3 scripts/build-email-templates.py
"""
from pathlib import Path

SITE = "https://foundryready.org"
IMG = f"{SITE}/email"
SUPPORT = "support@foundryready.org"
OUT = Path(__file__).resolve().parent.parent / "supabase" / "templates"

INK, MAROON, GOLD, MUTED = "#191919", "#8C1D40", "#FFC627", "#5c5c66"
FONT = "Arial,Helvetica,sans-serif"


def p(html: str, size: int = 16, color: str = INK, margin: str = "0 0 16px") -> str:
    return f'<p style="margin:{margin};font-family:{FONT};font-size:{size}px;line-height:1.6;color:{color}">{html}</p>'


def button(label: str, href: str = "{{ .ConfirmationURL }}") -> str:
    # Table-based "bulletproof" button: renders in Gmail, Outlook and Apple Mail.
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 24px">
  <tr><td align="center" bgcolor="{GOLD}" style="border-radius:999px;mso-padding-alt:16px 34px">
    <a href="{href}" target="_blank" style="display:inline-block;padding:16px 34px;font-family:{FONT};font-size:16px;font-weight:bold;color:{INK};text-decoration:none;border-radius:999px;background:{GOLD}">{label} &rarr;</a>
  </td></tr>
</table>"""


def steps(title: str, items: list[str]) -> str:
    rows = "".join(
        f"""<tr>
      <td valign="top" width="34" style="padding:0 0 12px"><div style="width:24px;height:24px;border-radius:12px;background:{MAROON};color:{GOLD};font-family:{FONT};font-size:12px;font-weight:bold;line-height:24px;text-align:center">{i}</div></td>
      <td valign="top" style="padding:2px 0 12px;font-family:{FONT};font-size:14px;line-height:1.5;color:{INK}">{t}</td>
    </tr>"""
        for i, t in enumerate(items, 1)
    )
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:#faf7ef;border:1px solid #f0e3bd;border-radius:14px">
  <tr><td style="padding:20px 22px 8px">
    <p style="margin:0 0 14px;font-family:{FONT};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:{MAROON}">{title}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table>
  </td></tr>
</table>"""


def fallback_link() -> str:
    return p(
        f'Button not working? Copy and paste this link into your browser:<br><a href="{{{{ .ConfirmationURL }}}}" style="color:{MAROON};word-break:break-all">{{{{ .ConfirmationURL }}}}</a>',
        size=12,
        color="#8a8a94",
        margin="0 0 20px",
    )


def notice(html: str) -> str:
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px">
  <tr><td style="padding:14px 16px;border-left:4px solid {MAROON};background:#f7f7f9;border-radius:0 10px 10px 0;font-family:{FONT};font-size:13px;line-height:1.55;color:{MUTED}">{html}</td></tr>
</table>"""


def layout(*, title: str, preheader: str, banner: str, banner_alt: str, body: str, reason: str) -> str:
    return f"""<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>{title}</title>
<style>
  @media (max-width:620px) {{
    .container {{ width:100% !important; border-radius:0 !important; }}
    .pad {{ padding-left:22px !important; padding-right:22px !important; }}
    .h1 {{ font-size:25px !important; }}
    .hide-sm {{ display:none !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#eeeef1;-webkit-text-size-adjust:100%">
<!-- Preheader: the preview line shown in the inbox -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">{preheader}&#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eeeef1">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e3e3e8">
    <!-- Header -->
    <tr><td class="pad" style="background:{INK};padding:20px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="left"><a href="{SITE}" target="_blank"><img src="{IMG}/logo.png" width="200" height="37" alt="FoundryReady" style="display:block;border:0;outline:none;width:200px;height:37px"></a></td>
        <td align="right" class="hide-sm" style="font-family:{FONT};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:{GOLD}">Trained today.<br><span style="color:#ffffff">Ready to start.</span></td>
      </tr></table>
    </td></tr>
    <!-- Banner -->
    <tr><td style="background:{INK};line-height:0;font-size:0">
      <img src="{IMG}/{banner}" width="600" alt="{banner_alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:{INK};color:#ffffff;font-family:{FONT};font-size:18px">
    </td></tr>
    <!-- Body -->
    <tr><td class="pad" style="padding:36px 40px 12px">
{body}
    </td></tr>
    <!-- Signature -->
    <tr><td class="pad" style="padding:0 40px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:12px"><img src="{IMG}/mark.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
        <td valign="middle" style="font-family:{FONT};font-size:14px;line-height:1.4;color:{INK}"><strong>The FoundryReady Admissions Team</strong><br><a href="mailto:{SUPPORT}" style="color:{MAROON};text-decoration:none">{SUPPORT}</a></td>
      </tr></table>
    </td></tr>
    <!-- Footer -->
    <tr><td style="height:5px;background:{MAROON};background-image:linear-gradient(90deg,{MAROON},{GOLD},{MAROON});line-height:5px;font-size:0">&nbsp;</td></tr>
    <tr><td class="pad" style="background:#fafafa;padding:24px 40px 28px;font-family:{FONT};font-size:12px;line-height:1.65;color:#80808a">
      <p style="margin:0 0 10px"><a href="{SITE}" style="color:{INK};font-weight:bold;text-decoration:none">foundryready.org</a> &nbsp;&middot;&nbsp; <a href="{SITE}/#programs" style="color:#80808a;text-decoration:underline">Programs</a> &nbsp;&middot;&nbsp; <a href="{SITE}/login" style="color:#80808a;text-decoration:underline">Sign in</a> &nbsp;&middot;&nbsp; <a href="mailto:{SUPPORT}" style="color:#80808a;text-decoration:underline">Help</a></p>
      <p style="margin:0 0 10px">{reason}</p>
      <p style="margin:0">FoundryReady &middot; No-cost, hands-on training for advanced manufacturing careers &middot; Phoenix, Arizona</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
"""


REASON_EMAIL = 'This email was sent to <strong style="color:#5c5c66">{{ .Email }}</strong> because it was used on FoundryReady. If that wasn&rsquo;t you, you can safely ignore it. Nothing changes until the link is used.'

TEMPLATES = {
    "confirm-signup.html": dict(
        title="Confirm your FoundryReady account",
        preheader="One click to confirm your email and start your application.",
        banner="banner-confirm.png",
        banner_alt="Confirm your email",
        reason=REASON_EMAIL,
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">Welcome to FoundryReady!</h1>',
            p("Thanks for creating your account. You&rsquo;re one step away from starting your application to no-cost, hands-on training for advanced manufacturing careers."),
            p("Please confirm your email address to activate your account."),
            button("Confirm my email"),
            steps("What happens next", [
                "<strong>Finish your application</strong>: about 5 minutes. Have your resume ready.",
                "<strong>Screening &amp; assessment</strong>: admissions reviews it and sends your online assessment.",
                "<strong>Enroll</strong>: choose your cohorts, sign your agreements, and you&rsquo;re in.",
            ]),
            fallback_link(),
            notice("For your security, this link expires after a limited time and can only be used once."),
        ]),
    ),
    "magic-link.html": dict(
        title="Your FoundryReady sign-in link",
        preheader="Your secure, one-time link to sign in. No password needed.",
        banner="banner-magic-link.png",
        banner_alt="Your sign-in link",
        reason=REASON_EMAIL,
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">Sign in to FoundryReady</h1>',
            p("Here&rsquo;s the secure sign-in link you asked for. Tap the button to go straight to your portal: no password needed."),
            button("Sign me in"),
            fallback_link(),
            notice("This link works once and expires shortly. If you didn&rsquo;t request it, you can ignore this email: your account is safe."),
        ]),
    ),
    "reset-password.html": dict(
        title="Reset your FoundryReady password",
        preheader="Choose a new password for your FoundryReady account.",
        banner="banner-reset-password.png",
        banner_alt="Reset your password",
        reason=REASON_EMAIL,
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">Reset your password</h1>',
            p("We received a request to reset the password for your FoundryReady account. Click below to choose a new one."),
            button("Choose a new password"),
            fallback_link(),
            notice("<strong style=\"color:#191919\">Didn&rsquo;t ask for this?</strong> Ignore this email and your password stays the same. The link expires after a limited time and can only be used once."),
        ]),
    ),
    "change-email.html": dict(
        title="Confirm your new FoundryReady email address",
        preheader="Confirm the new email address for your FoundryReady account.",
        banner="banner-change-email.png",
        banner_alt="Confirm your new email",
        reason='This email was sent because someone asked to change the email on a FoundryReady account. If that wasn&rsquo;t you, ignore it and contact <a href="mailto:' + SUPPORT + '" style="color:#80808a">' + SUPPORT + "</a>.",
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">Confirm your new email</h1>',
            p("You asked to change the email address on your FoundryReady account:"),
            f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;border:1px solid #e6e6ea;border-radius:12px">
  <tr><td style="padding:12px 16px;font-family:{FONT};font-size:14px;color:{MUTED};border-bottom:1px solid #e6e6ea">From&nbsp;&nbsp;<strong style="color:{INK}">{{{{ .Email }}}}</strong></td></tr>
  <tr><td style="padding:12px 16px;font-family:{FONT};font-size:14px;color:{MUTED}">To&nbsp;&nbsp;<strong style="color:{MAROON}">{{{{ .NewEmail }}}}</strong></td></tr>
</table>""",
            p("Confirm the change and all application updates will go to your new address.", margin="16px 0 0"),
            button("Confirm new email"),
            fallback_link(),
            notice("Didn&rsquo;t request this change? Don&rsquo;t click the button: your email stays the same."),
        ]),
    ),
    "invite-user.html": dict(
        title="You're invited to FoundryReady",
        preheader="You've been invited to join FoundryReady. Accept to set up your account.",
        banner="banner-invite.png",
        banner_alt="You're invited to FoundryReady",
        reason='This invitation was sent to <strong style="color:#5c5c66">{{ .Email }}</strong> by a FoundryReady administrator. If you weren&rsquo;t expecting it, you can ignore this email.',
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">You&rsquo;re invited</h1>',
            p("A FoundryReady administrator has invited you to join the platform that runs admissions for our advanced manufacturing training programs."),
            p("Accept the invitation to set up your account. Your access (admissions, employer partner, IT or content) is ready as soon as you sign in."),
            button("Accept invitation"),
            fallback_link(),
            notice("This invitation link expires after a limited time. Ask your administrator to resend it if it has expired."),
        ]),
    ),
    "reauthentication.html": dict(
        title="Your FoundryReady verification code",
        preheader="Your one-time FoundryReady verification code is inside.",
        banner="banner-reauth.png",
        banner_alt="Confirm it's you",
        reason=REASON_EMAIL.replace("Nothing changes until the link is used.", "Never share this code with anyone."),
        body="\n".join([
            f'<h1 class="h1" style="margin:0 0 18px;font-family:{FONT};font-size:28px;line-height:1.2;color:{INK}">Confirm it&rsquo;s you</h1>',
            p("Enter this one-time code to confirm the change to your account:"),
            f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
  <tr><td align="center" style="padding:22px;background:{INK};border-radius:14px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:{GOLD}">{{{{ .Token }}}}</td></tr>
</table>""",
            notice("The code expires shortly. FoundryReady staff will <strong style=\"color:#191919\">never</strong> ask you for it."),
        ]),
    ),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, t in TEMPLATES.items():
        (OUT / name).write_text(layout(**t))
        print("wrote", OUT / name)
