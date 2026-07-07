/* Shop — products from API, add to cart */

let productsCache = [];

function formatToast(message, isError = false) {
  let el = document.getElementById("shopToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "shopToast";
    el.className = "shop-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.add("is-visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("is-visible"), 2800);
}

function renderProducts(filter = "all", limit = null) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  let filtered = productsCache.filter((p) => filter === "all" || p.type === filter);
  if (limit) filtered = filtered.slice(0, limit);

  if (!filtered.length) {
    grid.innerHTML = `<p class="shop-empty">პროდუქტები ვერ ჩაიტვირთა. გაუშვით სერვერი: <code>npm start</code></p>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (item, i) => `
      <article class="product-card reveal-up" style="--delay: ${i * 0.06}s">
        <div class="product-card__image-wrap">
          <img src="${item.image}" alt="${item.name} აირსოფტის პროდუქტი" loading="lazy" />
          <span class="product-card__price">${item.priceFormatted}</span>
          ${!item.inStock ? '<span class="product-card__soldout">ამოწურული</span>' : ""}
        </div>
        <div class="product-card__body">
          <h3 class="product-card__title">${item.name}</h3>
          <p class="product-card__desc">${item.description}</p>
          <div class="product-card__actions">
            <button class="btn btn-outline btn-sm open-modal" data-product-id="${item.id}">დეტალები</button>
            <button
              class="btn btn-primary btn-sm add-to-cart"
              data-product-id="${item.id}"
              ${!item.inStock ? "disabled" : ""}
            >კალათაში</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");

  attachProductEvents();
  observeNewReveals();
}

function attachProductEvents() {
  document.querySelectorAll(".open-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = productsCache.find((p) => p.id === Number(btn.dataset.productId));
      if (product) openProductModal(product);
    });
  });

  document.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.productId);
      btn.disabled = true;
      try {
        await window.ACG_API.addToCart(id, 1);
        formatToast("დაემატა კალათაში");
        window.ACG_Cart?.refreshBadge();
      } catch (err) {
        formatToast(err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function openProductModal(product) {
  const modal = document.getElementById("productModal");
  if (!modal) return;

  document.getElementById("modalTitle").textContent = product.name;
  document.getElementById("modalImage").src = product.image;
  document.getElementById("modalImage").alt = `${product.name} დეტალური ფოტო`;
  document.getElementById("modalDescription").textContent = product.description;
  document.getElementById("modalPrice").textContent = `ფასი: ${product.priceFormatted}`;

  const addBtn = document.getElementById("modalAddToCart");
  if (addBtn) {
    addBtn.dataset.productId = product.id;
    addBtn.disabled = !product.inStock;
    addBtn.onclick = async () => {
      try {
        await window.ACG_API.addToCart(product.id, 1);
        formatToast("დაემატა კალათაში");
        window.ACG_Cart?.refreshBadge();
        modal.close();
      } catch (err) {
        formatToast(err.message, true);
      }
    };
  }

  modal.showModal();
}

function setupFilters() {
  const bar = document.getElementById("filterBar");
  if (!bar) return;

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    bar.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderProducts(btn.dataset.filter);
  });
}

function setupModal() {
  const modal = document.getElementById("productModal");
  const closeBtn = document.getElementById("modalClose");
  if (modal && closeBtn) closeBtn.addEventListener("click", () => modal.close());
}

function observeNewReveals() {
  if (!window.ACG?.revealObserver) return;
  document.querySelectorAll(".product-card.reveal-up:not(.is-visible)").forEach((el) => {
    window.ACG.revealObserver.observe(el);
  });
}

async function loadProducts() {
  try {
    const data = await window.ACG_API.getProducts();
    productsCache = data.products;
  } catch {
    productsCache = window.ACG_PRODUCTS_FALLBACK || [];
  }
}

async function initShop() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const isTeaser = grid.dataset.teaser === "true";
  const filter = grid.dataset.filter || "all";

  if (isTeaser && window.ACG_PRODUCTS_FALLBACK?.length) {
    productsCache = window.ACG_PRODUCTS_FALLBACK;
    renderProducts(filter, 4);
    setupModal();
  } else if (!isTeaser) {
    grid.innerHTML = `<p class="shop-loading">იტვირთება...</p>`;
  }

  await loadProducts();

  if (isTeaser) {
    renderProducts(filter, 4);
    setupModal();
  } else {
    renderProducts(filter);
    setupFilters();
    setupModal();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShop);
} else {
  initShop();
}

window.ACG = window.ACG || {};
window.ACG.products = () => productsCache;
