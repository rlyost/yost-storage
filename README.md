# Yost Storage

A lightweight static website hosted at [ryost.us](https://ryost.us).

## Pages

- `index.html` — Landing page with the dog logo, a right-side navigation menu, and the **RLTW!** signoff at the bottom of the screen.
- `PAWS_Training_Manual.html` — PAWS Service Dog Training Manual.

Both pages use `gitlabrador.webp` as their page logo and the square `favicon.png` as their favicon.

## Navigation

The landing-page menu links to:

- Home
- PAWS Training Manual
- [Yost Group](https://www.yost.group/index.html)
- [Apps](https://www.yost.group/apps/apps.html)
- [TitanLog](https://www.yost.group/apps/titanlog/titanlog.html)
- [YostNotes](https://www.yost.group/apps/yostnotes_app.html)
- [The Gateway](https://www.yost.group/apps/gateway_app.html)
- [Citadel Money](https://app.citadel-map.com)
- [GitHub](https://github.com/rlyost)

## Local preview

No build step is required. Open `index.html` directly in a browser, or serve the directory locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deployment

The `CNAME` file configures the custom domain as `ryost.us`.
