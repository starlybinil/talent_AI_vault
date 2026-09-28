// Renders the logo and banner PNGs used by the Supabase email templates into public/email/.
// Run from the repo root: node scripts/render-email-images.mjs public/email
import { chromium } from 'playwright';
const out = process.argv[2];
const MARK = `<svg viewBox="0 0 40 40" width="100%" height="100%"><rect width="40" height="40" rx="10" fill="#8C1D40"/><path d="M8 27V8h10.6v4.2h-6.3v3.4h5.4v4.2h-5.4V27z" fill="#FFC627"/><rect x="20.4" y="8" width="4.3" height="19" fill="#FFC627"/><path d="M22.4 10.15H26.4a3.7 3.7 0 0 1 0 7.4H22.4" fill="none" stroke="#FFC627" stroke-width="4.3"/><path d="M26.2 17.6 31.8 27" stroke="#FFC627" stroke-width="4.4"/><rect x="8" y="30.2" width="24" height="3.4" rx="1.7" fill="#FFC627"/><rect x="27.5" y="30.2" width="4.5" height="3.4" rx="1.7" fill="#FF7F32"/></svg>`;
// Lucide-style icons (stroke 2, 24 grid)
const I = {
  mailCheck: '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/>',
  sparkles: '<path d="M9.94 14.06 4 20"/><path d="m12 3 1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8L4.3 10.7l5.8-1.9Z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  mailSwap: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
};
const banners = [
  ['confirm', 'mailCheck', 'Welcome aboard', 'Confirm your email.', 'One click and your application is unlocked.'],
  ['magic-link', 'sparkles', 'Secure sign-in', 'Your sign-in link.', 'No password needed. Tap and you’re in.'],
  ['reset-password', 'key', 'Account security', 'Reset your password.', 'Choose a new password in under a minute.'],
  ['change-email', 'mailSwap', 'Account update', 'Confirm your new email.', 'Keep your application updates coming.'],
  ['invite', 'userPlus', 'You’re invited', 'Join FoundryReady.', 'Your team access is ready to set up.'],
  ['reauth', 'shield', 'Verification', 'Confirm it’s you.', 'Enter the one-time code to continue.'],
];
const css = `*{margin:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif}`;
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 2 });

// Header logo lockup (on dark header)
await p.setViewportSize({ width: 240, height: 44 });
await p.setContent(`<style>${css}body{background:#191919}</style><div style="display:flex;align-items:center;gap:10px;height:44px;padding-left:2px"><div style="width:38px;height:38px">${MARK}</div><div style="font-weight:900;font-size:25px;letter-spacing:-.6px;color:#fff">Foundry<span style="color:#FFC627">Ready</span></div></div>`);
await p.screenshot({ path: `${out}/logo.png` });

// Footer mark
await p.setViewportSize({ width: 40, height: 40 });
await p.setContent(`<style>${css}body{background:#fafafa}</style><div style="width:40px;height:40px">${MARK}</div>`);
await p.screenshot({ path: `${out}/mark.png`, omitBackground: false });

// Banners 600x220
await p.setViewportSize({ width: 600, height: 220 });
for (const [name, icon, eyebrow, title, sub] of banners) {
  await p.setContent(`<style>${css}
  .b{position:relative;width:600px;height:220px;overflow:hidden;background:#191919}
  .glow1{position:absolute;right:-80px;top:-120px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(140,29,64,.95),rgba(140,29,64,0) 70%)}
  .glow2{position:absolute;right:60px;bottom:-160px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(255,198,39,.35),rgba(255,198,39,0) 70%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:28px 28px}
  .txt{position:absolute;left:36px;top:44px;width:360px;color:#fff}
  .eb{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#FFC627}
  .t{margin-top:12px;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:-1px}
  .s{margin-top:12px;font-size:14px;color:rgba(255,255,255,.72)}
  .ic{position:absolute;right:54px;top:44px;width:132px;height:132px;border-radius:32px;background:linear-gradient(135deg,#FFC627,#FF9F2E);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(255,198,39,.35);transform:rotate(-6deg)}
  .ic svg{width:66px;height:66px}
  .bar{position:absolute;left:0;right:0;bottom:0;height:5px;background:linear-gradient(90deg,#8C1D40,#FFC627,#8C1D40)}
  </style><div class="b"><div class="grid"></div><div class="glow1"></div><div class="glow2"></div>
  <div class="txt"><div class="eb">${eyebrow}</div><div class="t">${title}</div><div class="s">${sub}</div></div>
  <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#191919" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[icon]}</svg></div>
  <div class="bar"></div></div>`);
  await p.screenshot({ path: `${out}/banner-${name}.png` });
}
await b.close();
