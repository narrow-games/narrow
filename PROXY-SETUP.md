# Full proxy setup (for heavy sites)

The Cloudflare Worker can't run script-heavy sites. Scramjet is a newer proxy built for them
(Ultraviolet's own README says Ultraviolet-App is no longer maintained and points to Scramjet).
It still won't work on every site, and I haven't been able to test any of this.

## Best option: run it on your own computer, then give it a public https address

1. Install Node.js (current LTS), Git, and pnpm:  `npm install -g pnpm`
2. In a terminal:
       git clone https://github.com/MercuryWorkshop/Scramjet-App
       cd Scramjet-App
       pnpm install
       pnpm start
   It prints the port it is using. Test it at http://localhost:<port> in Chrome.
3. Your console lives on https (github.io), so the proxy must be https too. Install Cloudflare's
   `cloudflared` and run:
       cloudflared tunnel --url http://localhost:<port>
   It prints an https://something.trycloudflare.com address. (It changes each run. For a permanent
   address, set up a named tunnel with a free Cloudflare account.)
4. In the console: open the Browser slot, click the gear, paste that address into
   "Full proxy server", and Save.

Your computer must stay on while you use it. Running it from home is also the best choice for
YouTube and captchas: Scramjet's README says those are unreliable when the server is on a
datacenter IP.

## Always-on option: a cloud host
Railway, Koyeb or similar can run the same repo (build: `pnpm install`, start: `pnpm start`, use
the port the host gives you). Because these are datacenter IPs, YouTube and captchas may be flaky.
Follow the repo README if its steps differ from these.

## Good to know
- Keep the address private. Anyone who has it can use your proxy.
- If the frame stays blank on github.io, your browser may be blocking the proxy's service worker
  inside another site. Use the arrow button in the Browser toolbar to open it in its own tab.
- If you use this on a school or work network, a proxy that gets around their filter may break
  their rules.
