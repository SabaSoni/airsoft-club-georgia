/* Order success page */

async function initOrderSuccess() {
  const root = document.getElementById("orderSuccessRoot");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order");

  if (!orderNumber) {
    root.innerHTML = `<p class="shop-empty">შეკვეთის ნომერი არ მოიძებნა.</p>`;
    return;
  }

  try {
    const { order } = await window.ACG_API.getOrder(orderNumber);
    const paymentLabels = {
      cash: "კატეზე გადახდა",
      bank: "ბანკის გადარიცხვა",
      card: "ბარათით მიწოდებისას"
    };

    root.innerHTML = `
      <div class="order-success">
        <div class="order-success__icon">✓</div>
        <h1>შეკვეთა მიღებულია</h1>
        <p class="order-success__number">№ ${order.orderNumber}</p>
        <p class="order-success__text">
          გმადლობთ, <strong>${order.customerName}</strong>! ჩვენ მალე დაგიკავშირდებით ნომერზე
          <strong>${order.phone}</strong>.
        </p>
        <div class="order-success__details card">
          <p><strong>მისამართი:</strong> ${order.address}</p>
          <p><strong>გადახდა:</strong> ${paymentLabels[order.paymentMethod] || order.paymentMethod}</p>
          <p><strong>ჯამი:</strong> ${order.totalFormatted}</p>
          <ul class="checkout-items" style="margin-top:1rem">
            ${order.items
              .map((i) => `<li><span>${i.name} × ${i.quantity}</span><span>${i.lineTotalFormatted}</span></li>`)
              .join("")}
          </ul>
        </div>
        <div class="order-success__actions">
          <a href="shop.html" class="btn btn-primary">მაღაზიაში დაბრუნება</a>
          <a href="index.html" class="btn btn-outline">მთავარი</a>
        </div>
      </div>
    `;
  } catch (err) {
    root.innerHTML = `<p class="shop-empty">${err.message}</p>`;
  }
}

if (document.getElementById("orderSuccessRoot")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOrderSuccess);
  } else {
    initOrderSuccess();
  }
}
