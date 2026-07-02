/* Checkout page */

async function initCheckout() {
  const summaryEl = document.getElementById("checkoutSummary");
  const form = document.getElementById("checkoutForm");
  if (!summaryEl || !form) return;

  try {
    const cart = await window.ACG_API.getCart();
    if (!cart.itemCount) {
      window.location.href = "cart.html";
      return;
    }

    summaryEl.innerHTML = `
      <h2>შეკვეთის დეტალები</h2>
      <ul class="checkout-items">
        ${cart.items
          .map(
            (item) => `
          <li>
            <span>${item.name} × ${item.quantity}</span>
            <span>${item.lineTotalFormatted}</span>
          </li>
        `
          )
          .join("")}
      </ul>
      <div class="checkout-total">
        <span>სულ</span>
        <strong>${cart.subtotalFormatted}</strong>
      </div>
    `;
  } catch {
    summaryEl.innerHTML = `<p class="shop-empty">კალათის ჩატვირთვა ვერ მოხერხდა</p>`;
    form.style.display = "none";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("checkoutMessage");
    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    msg.textContent = "";

    const payload = {
      customerName: form.customerName.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      address: form.address.value.trim(),
      paymentMethod: form.paymentMethod.value,
      notes: form.notes.value.trim()
    };

    try {
      const { order } = await window.ACG_API.placeOrder(payload);
      window.location.href = `order-success.html?order=${encodeURIComponent(order.orderNumber)}`;
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("is-error");
      submitBtn.disabled = false;
    }
  });
}

if (document.getElementById("checkoutForm")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCheckout);
  } else {
    initCheckout();
  }
}
