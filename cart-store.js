(function () {
  "use strict";

  const KEY = "acg-cart";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(lines) {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }

  window.ACG_CART_STORE = {
    getLines() {
      return read();
    },

    setLines(lines) {
      write(lines);
    },

    add(productId, quantity = 1) {
      const lines = read();
      const id = String(productId);
      const existing = lines.find((l) => String(l.productId) === id);
      if (existing) {
        existing.quantity = Math.min(99, existing.quantity + quantity);
      } else {
        lines.push({ productId: id, quantity: Math.max(1, quantity) });
      }
      write(lines);
    },

    update(productId, quantity) {
      const id = String(productId);
      let lines = read();
      if (quantity <= 0) {
        lines = lines.filter((l) => String(l.productId) !== id);
      } else {
        const line = lines.find((l) => String(l.productId) === id);
        if (line) line.quantity = Math.min(99, quantity);
      }
      write(lines);
    },

    remove(productId) {
      const id = String(productId);
      write(read().filter((l) => String(l.productId) !== id));
    },

    clear() {
      write([]);
    },

    getItemCount() {
      return read().reduce((sum, line) => sum + (line.quantity || 0), 0);
    }
  };
})();
