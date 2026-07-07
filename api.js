const API_BASE = "";

const SUPABASE_CDN =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

let supabaseClient = null;
let configPromise = null;
let profileCache = null;
let authBootstrapped = false;
let authReady = false;
let authUser = null;
const authListeners = new Set();

function mapSessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email.split("@")[0],
    phone: user.user_metadata?.phone || null,
    role: "user",
    isAdmin: false
  };
}

/** Remove old persistent tokens — they caused silent re-login days later. */
function clearLegacySupabaseStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") && key.includes("auth-token")) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem("acg-auth-hint");
  } catch (_) {}
}

function notifyAuthListeners() {
  authListeners.forEach((fn) => {
    try {
      fn(authUser);
    } catch (_) {}
  });
}

function setAuthUser(user) {
  authUser = user;
  notifyAuthListeners();
}

async function refreshAuthState() {
  const sb = await ensureSupabase();
  if (!sb) {
    clearProfileCache();
    setAuthUser(null);
    authReady = true;
    return null;
  }

  const {
    data: { user },
    error
  } = await sb.auth.getUser();

  if (error || !user) {
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    clearProfileCache();
    setAuthUser(null);
    authReady = true;
    return null;
  }

  setAuthUser(mapSessionUser(user));

  try {
    const data = await apiRequest("/api/auth/me");
    if (data.user) {
      profileCache = data;
      setAuthUser(data.user);
    }
  } catch (_) {}

  authReady = true;
  return authUser;
}

function bootstrapAuthListener(sb) {
  if (authBootstrapped || !sb) return;
  authBootstrapped = true;
  sb.auth.onAuthStateChange((event) => {
    if (event === "INITIAL_SESSION") return;
    if (event === "SIGNED_OUT") {
      clearProfileCache();
      setAuthUser(null);
      authReady = true;
      return;
    }
    refreshAuthState();
  });
}

clearLegacySupabaseStorage();

async function loadConfig() {
  if (!configPromise) {
    configPromise = fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .catch(() => ({}));
  }
  return configPromise;
}

async function ensureSupabase() {
  if (supabaseClient) return supabaseClient;
  const config = await loadConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;

  if (!document.querySelector('link[data-acg-supabase-preload]')) {
    const preload = document.createElement("link");
    preload.rel = "modulepreload";
    preload.href = SUPABASE_CDN;
    preload.setAttribute("data-acg-supabase-preload", "");
    document.head.appendChild(preload);
  }

  const { createClient } = await import(SUPABASE_CDN);
  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: window.sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  bootstrapAuthListener(supabaseClient);
  return supabaseClient;
}

window.ACG_SUPABASE_READY = ensureSupabase();

async function getSession() {
  const sb = await ensureSupabase();
  if (!sb) return null;
  const {
    data: { session }
  } = await sb.auth.getSession();
  return session;
}

function clearProfileCache() {
  profileCache = null;
}

async function authHeaders() {
  const sb = await ensureSupabase();
  if (!sb) return {};
  const {
    data: { session }
  } = await sb.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `მოთხოვნა ვერ შესრულდა (${res.status})`);
  }
  return data;
}

async function enrichCart() {
  const lines = window.ACG_CART_STORE?.getLines() || [];
  if (!lines.length) {
    return { items: [], subtotal: 0, subtotalFormatted: "₾0", itemCount: 0 };
  }

  const { products } = await apiRequest("/api/products");
  const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));

  const items = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const line of lines) {
    const product = byId[String(line.productId)];
    if (!product || !product.inStock) continue;
    const quantity = Math.min(line.quantity, product.stock);
    const lineTotal = product.price * quantity;
    subtotal += lineTotal;
    itemCount += quantity;
    items.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      unitPriceFormatted: product.priceFormatted,
      quantity,
      lineTotal,
      lineTotalFormatted: `₾${lineTotal}`,
      maxStock: product.stock
    });
  }

  return {
    items,
    subtotal,
    subtotalFormatted: `₾${subtotal}`,
    itemCount
  };
}

async function maybePromoteAdmin() {
  try {
    await apiRequest("/api/auth/promote-admin", { method: "POST" });
  } catch (_) {}
}

window.ACG_API = {
  getProducts(type = "all") {
    const q = type && type !== "all" ? `?type=${encodeURIComponent(type)}` : "";
    return apiRequest(`/api/products${q}`);
  },

  getProduct(id) {
    return apiRequest(`/api/products/${encodeURIComponent(id)}`);
  },

  async getCart() {
    return enrichCart();
  },

  async addToCart(productId, quantity = 1) {
    window.ACG_CART_STORE.add(productId, quantity);
    return enrichCart();
  },

  async updateCartItem(productId, quantity) {
    window.ACG_CART_STORE.update(productId, quantity);
    return enrichCart();
  },

  async removeFromCart(productId) {
    window.ACG_CART_STORE.remove(productId);
    return enrichCart();
  },

  async clearCart() {
    window.ACG_CART_STORE.clear();
    return enrichCart();
  },

  async placeOrder(payload) {
    const lines = window.ACG_CART_STORE.getLines();
    const result = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...payload, items: lines })
    });
    window.ACG_CART_STORE.clear();
    return result;
  },

  getOrder(orderNumber) {
    return apiRequest(`/api/orders/${encodeURIComponent(orderNumber)}`);
  },

  sendContact(payload) {
    return apiRequest("/api/contact", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async register(payload) {
    const sb = await ensureSupabase();
    if (!sb) throw new Error("Supabase არ არის კონფიგურირებული");

    const email = payload.email.trim().toLowerCase();
    const { data, error } = await sb.auth.signUp({
      email,
      password: payload.password,
      options: {
        data: {
          name: payload.name.trim(),
          phone: payload.phone?.trim() || null
        }
      }
    });

    if (error) {
      if (error.message.includes("already registered")) {
        throw new Error("ეს ელფოსტა უკვე რეგისტრირებულია");
      }
      throw new Error(error.message);
    }

    if (data.session) {
      clearProfileCache();
      await maybePromoteAdmin();
      await refreshAuthState();
      const me = await this.getMe({ force: true });
      return {
        message: me.user?.isAdmin ? "ადმინისტრატორის ანგარიში შეიქმნა" : "რეგისტრაცია წარმატებულია",
        user: me.user
      };
    }

    return {
      message:
        "რეგისტრაცია მიღებულია. გთხოვთ გახსნოთ ელფოსტა და დააჭიროთ დადასტურების ბმულს, შემდეგ შედით.",
      user: null,
      needsEmailConfirmation: true
    };
  },

  async login(payload) {
    const sb = await ensureSupabase();
    if (!sb) throw new Error("Supabase არ არის კონფიგურირებული");

    const { error } = await sb.auth.signInWithPassword({
      email: payload.email.trim().toLowerCase(),
      password: payload.password
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        throw new Error("ელფოსტა ჯერ არ არის დადასტურებული — შეამოწმეთ ინბოქსი ან სპამი");
      }
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        throw new Error("არასწორი ელფოსტა ან პაროლი");
      }
      throw new Error(error.message || "არასწორი ელფოსტა ან პაროლი");
    }

    clearProfileCache();
    await maybePromoteAdmin();
    await refreshAuthState();
    const me = await this.getMe({ force: true });
    return { message: "წარმატებით შეხვედით", user: me.user || authUser };
  },

  async logout() {
    const sb = await ensureSupabase();
    if (sb) await sb.auth.signOut();
    clearLegacySupabaseStorage();
    clearProfileCache();
    setAuthUser(null);
    authReady = true;
    return { message: "გამოსვლა წარმატებულია" };
  },

  getMe(options = {}) {
    if (!options.force && profileCache?.user) {
      return Promise.resolve(profileCache);
    }
    return apiRequest("/api/auth/me").then((data) => {
      if (data.user) profileCache = data;
      return data;
    });
  },

  async getSessionUser() {
    if (authUser) return authUser;
    const session = await getSession();
    if (!session?.user) return null;
    return mapSessionUser(session.user);
  },

  getRegisterStatus() {
    return apiRequest("/api/auth/register-status");
  },

  getDashboard() {
    return apiRequest("/api/user/dashboard");
  },

  async sendPasswordCode() {
    const sb = await ensureSupabase();
    if (!sb) throw new Error("Supabase არ არის კონფიგურირებული");
    const {
      data: { user }
    } = await sb.auth.getUser();
    if (!user?.email) throw new Error("მომხმარებელი ვერ მოიძებნა");

    const { error } = await sb.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false }
    });
    if (error) throw new Error(error.message);

    const masked = user.email.replace(/^(.{2}).+(@.+)$/, "$1***$2");
    return { message: `კოდი გაიგზავნა: ${masked}`, mode: "supabase_otp" };
  },

  async changePassword({ method, currentPassword, code, newPassword, confirmPassword }) {
    const sb = await ensureSupabase();
    if (!sb) throw new Error("Supabase არ არის კონფიგურირებული");

    if (newPassword !== confirmPassword) {
      throw new Error("პაროლები არ ემთხვევა");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("პაროლი მინიმუმ 8 სიმბოლო");
    }

    const {
      data: { user }
    } = await sb.auth.getUser();
    if (!user?.email) throw new Error("მომხმარებელი ვერ მოიძებნა");

    if (method === "email") {
      const { error } = await sb.auth.verifyOtp({
        email: user.email,
        token: String(code || "").trim(),
        type: "email"
      });
      if (error) throw new Error("არასწორი ან ვადაგასული კოდი");
    } else {
      const { error } = await sb.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (error) throw new Error("მიმდინარე პაროლი არასწორია");
    }

    const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message);

    return { message: "პაროლი წარმატებით შეიცვალა" };
  },

  getAttendance(slug) {
    return apiRequest(`/api/events/${encodeURIComponent(slug)}/attendance`);
  },

  attendEvent(slug) {
    return apiRequest(`/api/events/${encodeURIComponent(slug)}/attend`, { method: "POST" });
  },

  unattendEvent(slug) {
    return apiRequest(`/api/events/${encodeURIComponent(slug)}/attend`, { method: "DELETE" });
  }
};

window.ACG_AUTH = {
  getUser() {
    return authUser;
  },

  isReady() {
    return authReady;
  },

  waitReady() {
    if (authReady) return Promise.resolve(authUser);
    return authInitPromise.then(() => authUser);
  },

  subscribe(fn) {
    authListeners.add(fn);
    if (authReady) fn(authUser);
    return () => authListeners.delete(fn);
  },

  refresh: refreshAuthState
};

const authInitPromise = window.ACG_SUPABASE_READY.then((sb) => {
  if (sb) return refreshAuthState();
  authReady = true;
  return null;
});
