(() => {
  "use strict";

  const cfg = window.WIZO_CONFIG || {};
  const clientReady = !!(
    window.supabase &&
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_PUBLISHABLE_KEY
  );
  const db = clientReady
    ? window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_PUBLISHABLE_KEY
      )
    : null;

  const $ = id => document.getElementById(id);
  let sessionUser = null;
  let businessId = null;
  let businessName = "";
  let authMode = "signin";
  let currency = "SAR";

  const words = {
    en: {
      dashboard: "Dashboard", products: "Products & Stock",
      sales: "Sales", purchases: "Purchases", customers: "Customers",
      suppliers: "Suppliers", expenses: "Expenses", reports: "Reports",
      settings: "Settings", signout: "Sign out",
      workspace: "BUSINESS WORKSPACE"
    },
    om: {
      dashboard: "Gabatee", products: "Oomishaalee fi Kuusaa",
      sales: "Gurgurtaa", purchases: "Bittaa",
      customers: "Maamiltoota", suppliers: "Dhiyeessitoota",
      expenses: "Baasiilee", reports: "Gabaasa",
      settings: "Qindaa'ina", signout: "Ba'i",
      workspace: "IDDOO HOJII Daldalaa"
    },
    ar: {
      dashboard: "لوحة التحكم", products: "المنتجات والمخزون",
      sales: "المبيعات", purchases: "المشتريات",
      customers: "العملاء", suppliers: "الموردون",
      expenses: "المصروفات", reports: "التقارير",
      settings: "الإعدادات", signout: "تسجيل الخروج",
      workspace: "مساحة العمل"
    }
  };

  const pageNames = {
    dashboard: "Dashboard",
    products: "Products & Stock",
    sales: "Sales",
    purchases: "Purchases",
    customers: "Customers",
    suppliers: "Suppliers",
    expenses: "Expenses",
    reports: "Reports",
    settings: "Settings"
  };

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
  }

  function modal(title, msg) {
    $("modalTitle").textContent = title;
    $("modalMessage").textContent = msg;
    $("modalBackdrop").classList.remove("hidden");
  }

  function showAuth() {
    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
  }

  function showApp() {
    $("authScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    $("userAvatar").textContent =
      (sessionUser?.email || "W").charAt(0).toUpperCase();
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";

    $("authTitle").textContent = signup
      ? "Create your WIZO POS account"
      : "Welcome back";

    $("authSubtitle").textContent = signup
      ? "Register with your name, phone, email and password."
      : "Sign in to continue to WIZO POS.";

    $("authSubmit").textContent =
      signup ? "Create account" : "Sign in";

    $("authSwitchText").textContent =
      signup ? "Already have an account?" : "New to WIZO POS?";

    $("authSwitch").textContent = signup ? "Sign in" : "Create account";

    ["authNameWrap", "authPhoneWrap", "authConfirmWrap"].forEach(id => {
      if ($(id)) $(id).hidden = !signup;
    });

    ["authName", "authPhone", "authConfirmPassword"].forEach(id => {
      if ($(id)) $(id).required = signup;
    });

    $("authPassword").autocomplete =
      signup ? "new-password" : "current-password";
  }

  async function handleAuth(e) {
    e.preventDefault();

    if (!db) {
      modal(
        "Supabase is not configured",
        "Check config.js and make sure Supabase can load."
      );
      return;
    }

    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const fullName = $("authName")?.value.trim() || "";
    const phone = $("authPhone")?.value.trim() || "";
    const confirmPassword = $("authConfirmPassword")?.value || "";

    if (authMode === "signup") {
      if (!fullName || !phone) {
        modal("Missing information", "Please enter your full name and phone number.");
        return;
      }

      if (password !== confirmPassword) {
        modal("Password mismatch", "Password and Re-password must match.");
        $("authConfirmPassword").focus();
        return;
      }

      if (password.length < 6) {
        modal("Password too short", "Password must contain at least 6 characters.");
        return;
      }
    }

    $("authSubmit").disabled = true;

    try {
      const result = authMode === "signin"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                phone: phone
              }
            }
          });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        toast("Account created. Check your email to confirm, then sign in.");
        setAuthMode("signin");
      } else if (result.data.user) {
        sessionUser = result.data.user;
        await loadWorkspace();
      }
    } catch (err) {
      modal("Authentication error", err.message || "Unable to authenticate.");
    } finally {
      $("authSubmit").disabled = false;
    }
  }

  async function loadWorkspace() {
    showApp();

    const { data: members, error } = await db
      .from("business_members")
      .select("business_id,role,businesses(id,name,default_currency)")
      .eq("user_id", sessionUser.id)
      .limit(1);

    if (error) {
      modal("Workspace loading error", error.message);
      return;
    }

    if (!members?.length) {
      $("businessSetup").classList.remove("hidden");
      $("dashboardPage").classList.remove("hidden");
      $("welcomeTitle").textContent = "Create your first business";
      return;
    }

    const row = members[0];
    businessId = row.business_id;
    businessName = row.businesses?.name || "My supermarket";
    currency = row.businesses?.default_currency || "SAR";

    $("businessSetup").classList.add("hidden");
    $("sideBusinessName").textContent = businessName;
    $("welcomeTitle").textContent = `Welcome to ${businessName}`;
    $("currencySelect").value = currency;
    $("settingsCurrency").value = currency;

    await loadProducts();
  }

  async function createBusiness(e) {
    e.preventDefault();
    if (!db || !sessionUser) return;

    const name = $("businessName").value.trim();
    const owner = $("ownerName").value.trim();
    const cur = $("businessCurrency").value;

    if (!name || !owner) return;

    const { data, error } = await db.rpc("create_business", {
      p_name: name,
      p_owner_name: owner,
      p_currency: cur
    });

    if (error) {
      modal("Business setup failed", error.message);
      return;
    }

    businessId = data;
    businessName = name;
    currency = cur;

    $("businessSetup").classList.add("hidden");
    $("sideBusinessName").textContent = name;
    $("welcomeTitle").textContent = `Welcome to ${name}`;
    $("currencySelect").value = cur;
    $("settingsCurrency").value = cur;

    toast("Business workspace created");
    await loadProducts();
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  async function loadProducts() {
    if (!db || !businessId) return;

    const { data, error } = await db
      .from("products")
      .select("id,name,barcode,unit,cost_price,selling_price,stock_quantity")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return;
    }

    const rows = data || [];
    $("metricProducts").textContent = rows.length;
    $("productCount").textContent = `${rows.length} products`;

    const tbody = $("productsTable");
    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No products yet. Add your first product.</td></tr>';
      $("recentProducts").textContent = "No products added yet.";
      return;
    }

    for (const p of rows) {
      const tr = document.createElement("tr");
      [
        p.name,
        p.barcode || "—",
        p.unit,
        formatMoney(p.cost_price),
        formatMoney(p.selling_price),
        p.stock_quantity
      ].forEach(v => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    $("recentProducts").innerHTML = "";
    rows.slice(0, 5).forEach(p => {
      const d = document.createElement("div");
      d.className = "recent-row";
      d.textContent = `${p.name} · ${p.stock_quantity} ${p.unit}`;
      $("recentProducts").appendChild(d);
    });

    if ($("productSearch").value) filterProducts();
  }

  async function saveProduct(e) {
    e.preventDefault();

    if (!db || !businessId) {
      toast("Create a business workspace first");
      return;
    }

    const payload = {
      business_id: businessId,
      name: $("productName").value.trim(),
      barcode: $("productBarcode").value.trim() || null,
      unit: $("productUnit").value,
      cost_price: Number($("costPrice").value),
      selling_price: Number($("sellingPrice").value),
      stock_quantity: Number($("openingStock").value)
    };

    const { error } = await db.from("products").insert(payload);

    if (error) {
      modal("Could not save product", error.message);
      return;
    }

    $("productForm").reset();
    $("productFormWrap").classList.add("hidden");
    toast("Product saved");
    await loadProducts();
  }

  function filterProducts() {
    const q = $("productSearch").value.toLowerCase();
    [...$("productsTable").rows].forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  }

  function navigate(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

    const target = page === "settings"
      ? "settingsPage"
      : ["dashboard", "products"].includes(page)
        ? `${page}Page`
        : "placeholderPage";

    $(target).classList.remove("hidden");
    $("pageTitle").textContent = pageNames[page] || "WIZO POS";

    if (target === "placeholderPage") {
      $("placeholderTitle").textContent = pageNames[page] || "Coming next";
    }

    document.querySelectorAll(".nav-link[data-page]").forEach(b => {
      b.classList.toggle("active", b.dataset.page === page);
    });

    $("sidebar").classList.remove("open");
  }

  function applyLanguage(lang) {
    const dict = words[lang] || words.en;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const k = el.dataset.i18n;
      if (dict[k]) el.textContent = dict[k];
    });

    $("languageSelect").value = lang;
    $("settingsLanguage").value = lang;
  }

  async function signOut() {
    if (db) await db.auth.signOut();
    sessionUser = null;
    businessId = null;
    showAuth();
  }

  function wire() {
    $("year").textContent = new Date().getFullYear();
    $("authForm").addEventListener("submit", handleAuth);

    $("authSwitch").addEventListener("click", () => {
      setAuthMode(authMode === "signin" ? "signup" : "signin");
    });

    $("businessForm").addEventListener("submit", createBusiness);
    $("signOutBtn").addEventListener("click", signOut);

    document.querySelectorAll(".nav-link[data-page]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.page));
    });

    document.querySelectorAll("[data-goto]").forEach(b => {
      b.addEventListener("click", () => navigate(b.dataset.goto));
    });

    $("addProductBtn").addEventListener("click", () => {
      $("productFormWrap").classList.remove("hidden");
    });

    $("closeProductForm").addEventListener("click", () => {
      $("productFormWrap").classList.add("hidden");
    });

    $("productForm").addEventListener("submit", saveProduct);
    $("productSearch").addEventListener("input", filterProducts);
    $("refreshBtn").addEventListener("click", loadProducts);

    $("languageSelect").addEventListener("change", e => applyLanguage(e.target.value));
    $("authLanguage").addEventListener("change", e => applyLanguage(e.target.value));
    $("settingsLanguage").addEventListener("change", e => applyLanguage(e.target.value));

    $("currencySelect").addEventListener("change", e => {
      currency = e.target.value;
      $("settingsCurrency").value = currency;
      loadProducts();
    });

    $("settingsCurrency").addEventListener("change", e => {
      currency = e.target.value;
      $("currencySelect").value = currency;
      loadProducts();
    });

    $("menuToggle").addEventListener("click", () => {
      $("sidebar").classList.toggle("open");
    });

    $("modalClose").addEventListener("click", () => {
      $("modalBackdrop").classList.add("hidden");
    });
  }

  async function init() {
    wire();

    if (!clientReady) {
      $("connectionText").textContent = "Configuration missing";
      return;
    }

    $("connectionText").textContent = "Cloud configured";

    const { data: { session } } = await db.auth.getSession();

    if (session) {
      sessionUser = session.user;
      await loadWorkspace();
    } else {
      showAuth();
    }

    db.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        sessionUser = session.user;
        loadWorkspace();
      } else if (!session) {
        showAuth();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
