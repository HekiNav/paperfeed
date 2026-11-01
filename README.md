# paperfeed

A very WIP and broken RSS viewer and web scraper system that compiles posts into a newspaper-like view. Built using Vite and pretext.js. The project will be updated later with bug fixes and improvements

## CORS Proxy

Some feeds require an RSS proxy to be used due to the origin RSS server not providing the correct CORS HTTP headers. For this, please run your own, for example [this one](https://github.com/Rob--W/cors-anywhere). The proxy will forward requsts with the correct headers to the client. To avoid third party abuse of the cors proxy server, it is recommended to configure rate or speed limiting.

## Usage

1. Install `npm install`
2. Dev `npm run dev`
2. Build prod `npm run build`
2. Test prod `npm run preview`
2. Deploy prod (cloudflare) `npx wrangler deploy`