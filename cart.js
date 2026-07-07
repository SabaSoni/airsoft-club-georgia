/* Cart badge in header + cart page logic */

(function () {
  "use strict";

  function ensureCartButton() {
    const actions = document.querySelector(".header-actions");
    if (!actions || document.getElementById("cartBtn")) return;

    const cartLink = document.createElement("a");
    cartLink.href = "cart.html";
    cartLink.id = "cartBtn";
    cartLink.className = "cart-btn";
    cartLink.setAttribute("aria-label", "კალათა");
    cartLink.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <span class="cart-btn__count" id="cartCount">0</span>
    `;

    const toggle = document.getElementById("menuToggle");
    actions.insertBefore(cartLink, toggle);
  }

  async function refreshBadge() {
    const countEl = document.getElementById("cartCount");
    if (!countEl) return;

    const count = window.ACG_CART_STORE?.getItemCount?.() ?? 0;
    countEl.textContent = String(count);
    countEl.classList.toggle("is-hidden", count === 0);
  }

  window.ACG_Cart = { refreshBadge };

  document.addEventListener("DOMContentLoaded", () => {
    ensureCartButton();
    refreshBadge();
  });
})();

async function renderCartPage() {
  const root = document.getElementById("cartRoot");
  if (!root) return;

  root.innerHTML = `<p class="shop-loading">იტვირთება...</p>`;

  try {
    const { items, subtotalFormatted, itemCount } = await window.ACG_API.getCart();

    if (!itemCount) {
      root.innerHTML = `
        <div class="cart-empty">
          <p>კალათა ცარიელია</p>
          <a href="shop.html" class="btn btn-primary">მაღაზიაში გადასვლა</a>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="cart-layout">
        <div class="cart-items" id="cartItems">
          ${items
            .map(
              (item) => `
            <article class="cart-item" data-id="${item.productId}">
              <img src="${item.image}" alt="${item.name}" class="cart-item__img" />
              <div class="cart-item__info">
                <h3>${item.name}</h3>
                <p class="cart-item__price">${item.unitPriceFormatted}</p>
                <div class="cart-item__qty">
                  <button type="button" class="qty-btn" data-action="minus" aria-label="შემცირება">−</button>
                  <span class="qty-value">${item.quantity}</span>
                  <button type="button" class="qty-btn" data-action="plus" aria-label="გაზრდა">+</button>
                </div>
              </div>
              <div class="cart-item__side">
                <p class="cart-item__total">${item.lineTotalFormatted}</p>
                <button type="button" class="cart-item__remove" data-action="remove">წაშლა</button>
              </div>
            </article>
          `
            )
            .join("")}
        </div>
        <aside class="cart-summary">
          <h2>შეჯამება</h2>
          <div class="cart-summary__row">
            <span>ჯამი</span>
            <strong id="cartSubtotal">${subtotalFormatted}</strong>
          </div>
          <p class="cart-summary__note">გადახდა: კატეზე, ბანკის გადარიცხვა ან ბარათით მიწოდებისას.</p>
          <a href="checkout.html" class="btn btn-primary cart-summary__checkout">შეკვეთის გაფორმება</a>
          <button type="button" id="clearCartBtn" class="btn btn-ghost cart-summary__clear">კალათის გასუფთავება</button>
        </aside>
      </div>
    `;

    bindCartEvents();
  } catch (err) {
    root.innerHTML = `<p class="shop-empty">${err.message}</p>`;
  }
}

function bindCartEvents() {
  document.getElementById("cartItems")?.addEventListener("click", async (e) => {
    const row = e.target.closest(".cart-item");
    if (!row) return;
    const id = Number(row.dataset.id);
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    const qtyEl = row.querySelector(".qty-value");
    let qty = Number(qtyEl.textContent);

    try {
      if (action === "plus") {
        await window.ACG_API.updateCartItem(id, qty + 1);
      } else if (action === "minus") {
        await window.ACG_API.updateCartItem(id, qty - 1);
      } else if (action === "remove") {
        await window.ACG_API.removeFromCart(id);
      }
      await renderCartPage();
      window.ACG_Cart?.refreshBadge();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("clearCartBtn")?.addEventListener("click", async () => {
    if (!confirm("გსურთ კალათის გასუფთავება?")) return;
    await window.ACG_API.clearCart();
    await renderCartPage();
    window.ACG_Cart?.refreshBadge();
  });
}

if (document.getElementById("cartRoot")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderCartPage);
  } else {
    renderCartPage();
  }
}
