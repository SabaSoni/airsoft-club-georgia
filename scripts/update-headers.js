const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".html") && f !== "login.html");

const navDesktop = `        <nav class="site-nav" aria-label="მთავარი ნავიგაცია">
          <a href="index.html" class="site-nav__link" data-page="index">მთავარი</a>
          <a href="shop.html" class="site-nav__link" data-page="shop">მაღაზია</a>
          <a href="operations.html" class="site-nav__link" data-page="operations">ოპერაციები/ღონისძიებები</a>
          <a href="gallery.html" class="site-nav__link" data-page="gallery">გალერეა</a>
          <a href="contact.html" class="site-nav__link" data-page="contact">კონტაქტი</a>
          <a href="about.html" class="site-nav__link" data-page="about">ჩვენს შესახებ</a>
        </nav>`;

const navMobile = `    <nav id="mobileMenu" class="mobile-menu" aria-label="მობილური ნავიგაცია">
      <a href="index.html" class="mobile-menu__link" data-page="index">მთავარი</a>
      <a href="shop.html" class="mobile-menu__link" data-page="shop">მაღაზია</a>
      <a href="operations.html" class="mobile-menu__link" data-page="operations">ოპერაციები/ღონისძიებები</a>
      <a href="gallery.html" class="mobile-menu__link" data-page="gallery">გალერეა</a>
      <a href="contact.html" class="mobile-menu__link" data-page="contact">კონტაქტი</a>
      <a href="about.html" class="mobile-menu__link" data-page="about">ჩვენს შესახებ</a>
    </nav>`;

const authBtn = `<a href="login.html" class="btn btn-primary btn-sm header-auth-btn" id="headerAuthBtn">შესვლა</a>`;

for (const file of files) {
  const fp = path.join(dir, file);
  let html = fs.readFileSync(fp, "utf8");

  html = html.replace(/\s*<img src="\.\/assets\/logo-banner\.png"[^>]*>\s*/g, "\n");

  html = html.replace(/<nav class="site-nav"[\s\S]*?<\/nav>/, navDesktop);
  html = html.replace(/<nav id="mobileMenu"[\s\S]*?<\/nav>/, navMobile);

  html = html.replace(
    /<a href="shop\.html" class="btn btn-primary btn-sm header-shop-cta">მაღაზია<\/a>/,
    authBtn
  );

  fs.writeFileSync(fp, html);
  console.log("Updated", file);
}
