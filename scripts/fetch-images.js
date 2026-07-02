const https = require("https");

const slugs = [
  "wellfire-d96-m4-carbine-airsoft-aeg-rifle-w-scope-and-grip-black",
  "wg-full-metal-us-combat-1911-co2-airsoft-pistol-black",
  "vorsk-raven-r9-4-gbb-airsoft-pistol-tan",
  "h-k-p30-electric-airsoft-pistol-semi-full-auto",
  "wellfire-ak47-aeg-airsoft-rifle-black-wood",
  "fn-herstal-entry-level-scar-electric-lpeg-airsoft-rifle-w-red-dot-sight-black"
];

function fetch(slug) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://airsoftstation.com/${slug}/`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const m = data.match(/"image":\s*"(https:\/\/cdn11[^"]+)"/);
          resolve({ slug, image: m ? m[1] : null });
        });
      })
      .on("error", reject);
  });
}

Promise.all(slugs.map(fetch)).then((r) => console.log(JSON.stringify(r, null, 2)));
