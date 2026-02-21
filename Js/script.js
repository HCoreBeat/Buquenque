let cart = JSON.parse(localStorage.getItem("cart")) || [];
let products = [];
let currentProduct = null;
let categories = [];

// Caches y utilidades para optimización
let carouselSlidesCache = null;
let carouselIndicatorsCache = null;

// Debounce helper
function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
const SEARCH_DEBOUNCE_MS = 250;

// Helper to determine if a product (or grouped product) should be considered available
function productIsAvailable(p) {
  if (!p) return false;
  // direct availability flag
  if (p.disponibilidad === false) {
    // if grouped, check variants as a fallback
    if (p.isGrouped && Array.isArray(p.variants)) {
      return p.variants.some((v) => v.disponibilidad !== false);
    }
    return false;
  }
  // if grouped but main item marked available, we still want to ensure at least one variant is available
  if (p.isGrouped && Array.isArray(p.variants)) {
    return p.variants.some((v) => v.disponibilidad !== false);
  }
  return true;
}

// Normaliza strings eliminando tildes/diacríticos — usado para búsqueda insensible a acentos
function normalizeString(str) {
  return str ? String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[\u0300-\u036f]/g, '') : '';
}

// Distancia de Levenshtein (para matching aproximado)
function levenshtein(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Fuzzy match: devuelve true si el término y el texto son suficientemente similares
function fuzzyMatch(term, text) {
  if (!term || !text) return false;
  const t = String(term).toLowerCase();
  const s = String(text).toLowerCase();
  if (s.includes(t)) return true; // rápido: substring
  const maxDistance = Math.max(1, Math.floor(t.length * 0.35));
  return levenshtein(t, s) <= maxDistance;
}

// ========== VARIABLES DEL CARRUSEL ==========
let currentSlide = 0;
let carouselAutoplayInterval = null;
const CAROUSEL_AUTOPLAY_DELAY = 10000; // 10 segundos

// Función para ir al inicio
function goToHome() {
  window.location.hash = "";
  hideProductDetail();
  renderProducts();
}

// Manejo del historial con hash y pushState
window.addEventListener("popstate", handleRouteChange);
window.addEventListener("hashchange", handleRouteChange);

function handleRouteChange() {
  const hash = window.location.hash.substring(1);
  const backBtnWrapper = document.getElementById("category-back-button-wrapper");

  if (!hash) {
    // Al volver a la raíz: ocultar detalles y el botón de volver a categorías
    if (backBtnWrapper) backBtnWrapper.style.display = "none";
    hideProductDetail();
    hidePackDetail();
    hidePacksDetail();

    // Restaurar vista 'Todo' (sin modificar el historial)
    const categoryCardSection = document.getElementById("category-card-section");
    const categoriesCircleSection = document.querySelector(".categories-circle-section");
    const banner = document.querySelector(".carousel-container");
    const productsContainer = document.getElementById("products-container");

    if (categoryCardSection) categoryCardSection.style.display = "block";
    if (categoriesCircleSection) categoriesCircleSection.style.display = "block";
    if (banner) banner.style.display = "block";
    if (productsContainer) productsContainer.style.display = "grid";

    // Renderizar todos los productos y secciones relacionadas
    renderProducts();
    renderBestSellers();
    renderCategoriesCircle();

    return;
  }

  const decodedHash = decodeURIComponent(hash);

  // Detectar si es una categoría (formato: category=NombreCategoria)
  if (decodedHash.startsWith("category=")) {
    const categoryName = decodedHash.substring(9); // Remove "category=" prefix
    filterByCategory(categoryName);
    return;
  }

  // Para otras rutas (packs, producto, pack) asegurar que el botón de volver esté oculto
  if (backBtnWrapper) backBtnWrapper.style.display = "none";

  // Caso especial: panel de packs
  if (decodedHash === 'packs') {
    // Mostrar panel de packs
    renderPacksDetail();
    return;
  }

  // Detectar si es un pack o un producto
  const isPack = packs.find((p) => p.nombre === decodedHash);

  if (isPack) {
    // Es un pack
    showPackDetail(decodedHash);
  } else {
    // Es un producto
    showProductDetail(decodedHash);
  }
}

const bannerContainer = document.querySelector(".carousel-container"); // <-- Nueva referencia al carrusel
const bestSellersSection = document.querySelector(".best-sellers-section"); // <-- Referencia a best-sellers

// ========== FUNCIONES DEL CARRUSEL ==========

/**
 * Inicializa el carrusel de banners
 */
function initCarousel() {
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  const indicators = document.querySelectorAll(".carousel-indicator");
  const slides = document.querySelectorAll(".carousel-slide");

  // Cachear nodos para evitar búsquedas repetidas
  carouselSlidesCache = slides;
  carouselIndicatorsCache = indicators;

  // Event listeners para los botones
  if (prevBtn) prevBtn.addEventListener("click", () => changeSlide(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => changeSlide(1));

  // Event listeners para los indicadores
  indicators.forEach((indicator, index) => {
    indicator.addEventListener("click", () => goToSlide(index));
  });

  // Iniciar autoplay
  startCarouselAutoplay();

  // Pausar autoplay al pasar el mouse (solo en desktop)
  const carouselContainer = document.querySelector(".carousel-container");
  if (carouselContainer) {
    carouselContainer.addEventListener("mouseenter", pauseCarouselAutoplay);
    carouselContainer.addEventListener("mouseleave", startCarouselAutoplay);
  }
}

/**
 * Cambia al siguiente o anterior slide
 * @param {number} direction - 1 para siguiente, -1 para anterior
 */
function changeSlide(direction) {
  pauseCarouselAutoplay();
  currentSlide += direction;

  const slides = document.querySelectorAll(".carousel-slide");
  if (currentSlide >= slides.length) {
    currentSlide = 0;
  } else if (currentSlide < 0) {
    currentSlide = slides.length - 1;
  }

  updateCarousel();
  startCarouselAutoplay();
}

/**
 * Va a un slide específico
 * @param {number} index - Índice del slide
 */
function goToSlide(index) {
  pauseCarouselAutoplay();
  currentSlide = index;
  updateCarousel();
  startCarouselAutoplay();
}

/**
 * Actualiza la visualización del carrusel
 */
function updateCarousel() {
  const slides =
    carouselSlidesCache || document.querySelectorAll(".carousel-slide");
  const indicators =
    carouselIndicatorsCache || document.querySelectorAll(".carousel-indicator");

  // Remover/añadir clase active de forma eficiente
  slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === currentSlide);
  });
  indicators.forEach((indicator, i) => {
    indicator.classList.toggle("active", i === currentSlide);
  });
}

/**
 * Inicia el autoplay del carrusel
 */
function startCarouselAutoplay() {
  carouselAutoplayInterval = setInterval(() => {
    changeSlide(1);
  }, CAROUSEL_AUTOPLAY_DELAY);
}

/**
 * Pausa el autoplay del carrusel
 */
function pauseCarouselAutoplay() {
  if (carouselAutoplayInterval) {
    clearInterval(carouselAutoplayInterval);
    carouselAutoplayInterval = null;
  }
}

// Cargar productos
async function loadProducts() {
  try {
    // Siempre hacer fetch fresco para evitar problemas con cambios en products.json
    const response = await fetch("Json/products.json");
    if (!response.ok) throw new Error("Error al cargar productos");
    const data = await response.json();

    // Procesar productos para manejar variantes
    const productGroups = {};

    data.products.forEach((product) => {
      // Extraer nombre base y versión
      const baseName = product.nombre.split("(")[0].trim();
      const variantName = product.nombre.match(/\((.*?)\)/)?.[1] || "";

      if (!productGroups[baseName]) {
        productGroups[baseName] = {
          baseName: baseName,
          variants: [],
        };
      }

      productGroups[baseName].variants.push({
        ...product,
        cleanName: product.nombre.replace(/\(v\d+\)\s*/g, ""),
        variantName: variantName,
      });
    });

    // Crear array de productos
    products = [];
    for (const baseName in productGroups) {
      const group = productGroups[baseName];

      if (group.variants.length > 1) {
        // Producto con variantes
        // Encontrar la primera variante disponible, sino usar la primera
        const availableIndex = group.variants.findIndex(
          (v) => v.disponibilidad === true
        );
        const defaultVariantIndex = availableIndex !== -1 ? availableIndex : 0;

        products.push({
          ...group.variants[0],
          id: `group_${baseName}`, // ID único para grupos
          isGrouped: true,
          baseName: baseName,
          variants: group.variants,
          currentVariant: defaultVariantIndex,
        });
      } else {
        // Producto sin variantes
        products.push(group.variants[0]);
      }
    }

    // Preprocesar (normalizar) campos para búsqueda/auto-complete (insensible a tildes)
    products.forEach((p) => {
      p._normalizedNombre = normalizeString(p.nombre).toLowerCase();
      p._normalizedDescripcion = normalizeString(p.descripcion || '').toLowerCase();
      p._normalizedCategoria = normalizeString(p.categoria || '').toLowerCase();
      if (p.variants && Array.isArray(p.variants)) {
        p.variants.forEach((v) => {
          v._normalizedNombre = normalizeString(v.nombre).toLowerCase();
          v._normalizedDescripcion = normalizeString(v.descripcion || '').toLowerCase();
          v._normalizedCategoria = normalizeString(v.categoria || '').toLowerCase();
        });
      }
    });

    categories = [
      "Todo",
      ...new Set(products.map((product) => product.categoria)),
    ];
    
    // ===== INICIALIZAR SISTEMA DINÁMICO =====
    if (typeof initDynamicSystem === 'function') {
      initDynamicSystem();
    }
    
    renderCategories();
    initPriceFilter();
    renderProducts();
    renderBestSellers();
    renderCategoriesCircle();
    updateCartCount();
    updateCart();

    document
      .getElementById("close-sidebar")
      ?.addEventListener("click", toggleSidebar);
    document
      .getElementById("menu-toggle")
      ?.addEventListener("click", toggleSidebar);
    document
      .getElementById("overlay")
      ?.addEventListener("click", toggleSidebar);
  } catch (error) {
    console.error("Error:", error);
    alert("Error al cargar los productos. Por favor recarga la página.");
  }
}

// Renderizar categorías
function renderCategories() {
  const sidebarCategories = document.getElementById("sidebar-categories");
  const desktopCategories = document.getElementById("categories-list");

  const categoryItems = categories
    .map(
      (category) => `
        <li onclick="filterByCategory('${category}')">
            <i class="fas fa-${getCategoryIcon(category)}"></i>
            ${category}
        </li>
    `
    )
    .join("");

  if (sidebarCategories) sidebarCategories.innerHTML = categoryItems;
  if (desktopCategories) desktopCategories.innerHTML = categoryItems;
}
// Función auxiliar para iconos de categorías
function getCategoryIcon(category) {
  const icons = {
    todo: "th-large",
    electrónica: "mobile-alt",
    ropa: "tshirt",
    hogar: "home",
    deportes: "running",
    juguetes: "gamepad",
    salud: "heartbeat",
    belleza: "spa",
    automóviles: "car",
    herramientas: "wrench",
    comida: "utensils",
    bebidas: "wine-glass-alt",
    postres: "cookie-bite",
    frutas: "apple-alt",
    verduras: "carrot",
    "cárnicos y embutidos": "drumstick-bite",
    pescado: "fish",
    panadería: "bread-slice",
    lácteos: "cheese",
    cafetería: "coffee",
    embutidos: "hamburger",
    despensa: "shopping-basket",
    confitura: "pizza-slice",
    "bebidas no alcohólicas": "glass-whiskey",
    "utiles del hogar": "broom",
    "aseo y belleza": "soap",
    tecnología: "laptop",
    aderezos: "spoon",
    "bebidas alcohólicas": "cocktail",
    electrodomésticos: "blender",
  };

  return icons[category.toLowerCase().trim()] || "tag"; // Convertimos a minúsculas y eliminamos espacios extra
}

function initPriceFilter() {
  const minPriceInput = document.getElementById("min-price");
  const maxPriceInput = document.getElementById("max-price");
  const minPriceSlider = document.getElementById("price-slider-min");
  const maxPriceSlider = document.getElementById("price-slider-max");
  const applyFilterBtn = document.getElementById("apply-price-filter");

  if (!minPriceInput || !maxPriceInput || !minPriceSlider || !maxPriceSlider)
    return;

  // Valores iniciales basados en los productos
  const prices = products.map((p) => p.precio);
  const minPrice = Math.floor(Math.min(...prices));
  const maxPrice = Math.ceil(Math.max(...prices));

  // Configurar sliders
  minPriceSlider.min = minPrice;
  minPriceSlider.max = maxPrice;
  minPriceSlider.value = minPrice;

  maxPriceSlider.min = minPrice;
  maxPriceSlider.max = maxPrice;
  maxPriceSlider.value = maxPrice;

  // Set initial input values
  minPriceInput.value = minPrice;
  maxPriceInput.value = maxPrice;

  // Update slider track initially
  updatePriceSlider();

  // Actualizar inputs cuando se mueven los sliders
  minPriceSlider.addEventListener("input", () => {
    minPriceInput.value = minPriceSlider.value;
    updatePriceSlider();
  });

  maxPriceSlider.addEventListener("input", () => {
    maxPriceInput.value = maxPriceSlider.value;
    updatePriceSlider();
  });

  // Actualizar sliders cuando se editan los inputs
  minPriceInput.addEventListener("change", () => {
    let value = Math.max(
      minPrice,
      Math.min(maxPrice, parseInt(minPriceInput.value) || minPrice)
    );
    minPriceSlider.value = value;
    minPriceInput.value = value;
    updatePriceSlider();
  });

  maxPriceInput.addEventListener("change", () => {
    let value = Math.max(
      minPrice,
      Math.min(maxPrice, parseInt(maxPriceInput.value) || maxPrice)
    );
    maxPriceSlider.value = value;
    maxPriceInput.value = value;
    updatePriceSlider();
  });

  // Aplicar filtros
  applyFilterBtn.addEventListener("click", applyPriceFilter);

  // Función para actualizar el track del slider
  function updatePriceSlider() {
    const minVal = parseInt(minPriceSlider.value);
    const maxVal = parseInt(maxPriceSlider.value);

    // Prevent sliders from crossing
    if (minVal > maxVal) {
      minPriceSlider.value = maxVal;
      minPriceInput.value = maxVal;
    } else if (maxVal < minVal) {
      maxPriceSlider.value = minVal;
      maxPriceInput.value = minVal;
    }

    const track = document.querySelector(".price-slider-track");
    if (track) {
      const minPercent =
        ((minPriceSlider.value - minPrice) / (maxPrice - minPrice)) * 100;
      const maxPercent =
        ((maxPriceSlider.value - minPrice) / (maxPrice - minPrice)) * 100;

      track.style.left = `${minPercent}%`;
      track.style.width = `${maxPercent - minPercent}%`;
    }
  }

  // Función para aplicar filtros
  function applyPriceFilter() {
    const minPrice = parseInt(minPriceInput.value) || 0;
    const maxPrice = parseInt(maxPriceInput.value) || Infinity;

    const filteredProducts = products.filter((product) => {
      const finalPrice =
        product.oferta && product.descuento > 0
          ? product.precio * (1 - product.descuento / 100)
          : product.precio;
      return finalPrice >= minPrice && finalPrice <= maxPrice;
    });

    renderProducts(filteredProducts);
    renderBestSellers();
    renderCategoriesCircle();
    closeSidebar();
  }
}

// Filtrar por categoría
function filterByCategory(category) {
  // Ocultar mensaje de no resultados si está visible
  hideNoResultsMessage();

  // Limpiar campo de búsqueda
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.value = "";
  }

  // Ocultar detalle de producto si está visible
  if (document.getElementById("product-detail")?.style.display === "block") {
    hideProductDetail();
  }

  // Elementos a controlar
  const categoryCardSection = document.getElementById("category-card-section");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const categoryBackButtonWrapper = document.getElementById("category-back-button-wrapper");

  // Mostrar/ocultar botón de atrás según la categoría
  if (category !== "Todo") {
    // Mostrar botón si es una categoría específica
    if (categoryBackButtonWrapper) {
      categoryBackButtonWrapper.style.display = "block";
    }
    // Ocultar packs, category-card y best-sellers
    hidePacksDetail();
    if (categoryCardSection) {
      categoryCardSection.style.display = "none";
    }
    if (bestSellersSection) {
      bestSellersSection.style.display = "none";
    }
    // Actualizar URL con pushState para la categoría
    const categoryHash = `category=${encodeURIComponent(category)}`;
    if (window.location.hash.substring(1) !== categoryHash) {
      window.history.pushState({ category: category }, `Categoría: ${category}`, `#${categoryHash}`);
    }
  } else {
    // Ocultar botón si es "Todo"
    if (categoryBackButtonWrapper) {
      categoryBackButtonWrapper.style.display = "none";
    }
    // Mostrar el category-card y best-sellers
    if (categoryCardSection) {
      categoryCardSection.style.display = "block";
    }
    if (bestSellersSection) {
      bestSellersSection.style.display = "block";
    }
    // Limpiar URL cuando vuelve a "Todo"
    if (window.location.hash) {
      window.history.pushState({ category: "Todo" }, "Todas las categorías", "#");
    }
  }

  // Filtrar productos
  const filteredProducts =
    category === "Todo"
      ? products
      : products.filter((product) => product.categoria === category);

  renderProducts(filteredProducts);
  renderBestSellers();
  renderCategoriesCircle();

  // Cerrar sidebar en móvil
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// Buscar productos (ahora en tiempo real)
function searchProducts() {
  const searchInput = document.getElementById("search-input");
  const productsContainer = document.getElementById("products-container");
  const noResultsMessage = document.getElementById("no-results-message");

  if (!searchInput || !productsContainer) return;

  // Ocultar detalle de producto si está visible
  if (document.getElementById("product-detail")?.style.display === "block") {
    hideProductDetail();
  }

  const searchTerm = searchInput.value.toLowerCase().trim();

  // Obtener elementos que necesitamos controlar
  const packsDetailContainer = document.getElementById("packs-detail");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const categoryCardSection = document.getElementById("category-card-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");

  if (searchTerm) {
    // Cuando hay búsqueda activa: mostrar SOLO productos
    // Ocultar packs-detail y category-card
    if (packsDetailContainer) packsDetailContainer.style.display = "none";
    if (categoryCardSection) categoryCardSection.style.display = "none";
    if (categoriesCircleSection) categoriesCircleSection.style.display = "none";
    
    // Mostrar explícitamente products-container (puede estar oculto si estábamos en packs-detail)
    if (productsContainer) productsContainer.style.display = "grid";
    
    // Mostrar banner y best-sellers para contexto
    if (bannerContainer) bannerContainer.style.display = "block";
    if (bestSellersSection) bestSellersSection.style.display = "block";
  } else {
    // Cuando se limpia búsqueda: restaurar home completo
    if (productsContainer) productsContainer.style.display = "grid";
    if (bannerContainer) bannerContainer.style.display = "block";
    if (bestSellersSection) bestSellersSection.style.display = "block";
    if (categoryCardSection) categoryCardSection.style.display = "block";
    if (categoriesCircleSection) categoriesCircleSection.style.display = "block";
    if (packsDetailContainer) packsDetailContainer.style.display = "none";
  }

  if (!searchTerm) {
    renderProducts();
    renderBestSellers();
    renderCategoriesCircle();
    hideNoResultsMessage();
    return;
  }

  const normalizedTerm = normalizeString(searchTerm).toLowerCase();
  let filteredProducts = [];

  // 1) Coincidencias exactas (substring) sobre campos normalizados
  const exactMatches = products
    .filter(productIsAvailable)
    .filter((product) => {
      const name = product._normalizedNombre || normalizeString(product.nombre).toLowerCase();
      const desc = product._normalizedDescripcion || normalizeString(product.descripcion || '').toLowerCase();
      const cat = product._normalizedCategoria || normalizeString(product.categoria || '').toLowerCase();
      return name.includes(normalizedTerm) || desc.includes(normalizedTerm) || cat.includes(normalizedTerm);
    });

  if (exactMatches.length > 0) {
    filteredProducts = exactMatches;
  } else {
    // 2) Fallback fuzzy (errores tipográficos / faltan acentos)
    filteredProducts = products
      .filter(productIsAvailable)
      .filter((product) => {
        const name = product._normalizedNombre || normalizeString(product.nombre).toLowerCase();
        const desc = product._normalizedDescripcion || normalizeString(product.descripcion || '').toLowerCase();
        return fuzzyMatch(normalizedTerm, name) || fuzzyMatch(normalizedTerm, desc);
      });
  }

  // Actualizar dropdown de sugerencias en tiempo real
  try { renderSearchSuggestions(getSearchSuggestions(normalizedTerm, 6)); } catch(e) { /* safe */ }


  if (filteredProducts.length > 0) {
    renderProducts(filteredProducts);
    renderBestSellers();
    renderCategoriesCircle();
    hideNoResultsMessage();
  } else {
    productsContainer.innerHTML = "";
    showNoResultsMessage(searchTerm);
  }
}

function showNoResultsMessage(searchTerm) {
  let noResultsMessage = document.getElementById("no-results-message");

  // Crear el mensaje si no existe
  if (!noResultsMessage) {
    noResultsMessage = document.createElement("div");
    noResultsMessage.id = "no-results-message";
    noResultsMessage.className = "no-results-container";
    noResultsMessage.innerHTML = `
            <div class="no-results-content">
                <i class="fas fa-search no-results-icon"></i>
                <h3 class="no-results-title">No encontramos resultados</h3>
                <p class="no-results-message">No hay productos que coincidan con "<span class="no-results-term">${searchTerm}</span>"</p>
                <button class="clear-search-btn" onclick="clearSearch()">
                    <i class="fas fa-times"></i> Limpiar búsqueda
                </button>
            </div>
        `;
    document.getElementById("main-content").appendChild(noResultsMessage);
  } else {
    // Actualizar el mensaje existente
    noResultsMessage.querySelector(".no-results-term").textContent = searchTerm;
    noResultsMessage.style.display = "block";
  }
}

function hideNoResultsMessage() {
  const noResultsMessage = document.getElementById("no-results-message");
  if (noResultsMessage) {
    noResultsMessage.style.display = "none";
  }
}

// Función para limpiar la búsqueda
function clearSearch() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.value = "";
    searchInput.focus();
  }
  renderProducts();
  hideNoResultsMessage();
  clearSearchSuggestions();
}

// ---------- Helpers para suggestions / búsqueda aproximada ----------
function getSearchSuggestions(normalizedTerm, limit = 6) {
  const suggestions = [];
  if (!normalizedTerm) return suggestions;

  const seen = new Set();
  const pushSuggestion = (type, data) => {
    const key = type + '::' + (type === 'category' ? data : (data.id || data.nombre));
    if (seen.has(key)) return false;
    seen.add(key);
    suggestions.push({ type, data });
    return suggestions.length >= limit;
  };

  // 1) Productos - coincidencias exactas por nombre (solo disponibles)
  const prodExact = products
    .filter(productIsAvailable)
    .filter((p) => (p._normalizedNombre || '').includes(normalizedTerm));
  for (const p of prodExact) {
    if (pushSuggestion('product', p)) return suggestions;
  }

  // 2) Packs - coincidencias exactas por nombre o texto de búsqueda
  const packExact = (packs || []).filter((pack) => {
    const name = pack._normalizedNombre || normalizeString(pack.nombre).toLowerCase();
    const desc = pack._normalizedDescripcion || normalizeString(pack.descripcion || pack.searchText || '').toLowerCase();
    return name.includes(normalizedTerm) || desc.includes(normalizedTerm);
  });
  for (const pack of packExact) {
    if (pushSuggestion('pack', pack)) return suggestions;
  }

  // 3) Categorías (priorizar coincidencias de categoría)
  const catExact = (categories || [])
    .filter((c) => c && c !== 'Todo')
    .filter((c) => normalizeString(c).toLowerCase().includes(normalizedTerm));
  for (const c of catExact) {
    if (pushSuggestion('category', c)) return suggestions;
  }

  // 4) Productos fuzzy (fallback) – únicamente disponibles
  const prodFuzzy = products
    .filter(productIsAvailable)
    .filter((p) => {
      const name = p._normalizedNombre || normalizeString(p.nombre).toLowerCase();
      const desc = p._normalizedDescripcion || normalizeString(p.descripcion || '').toLowerCase();
      return fuzzyMatch(normalizedTerm, name) || fuzzyMatch(normalizedTerm, desc);
    })
    .filter((p) => !seen.has('product::' + (p.id || p.nombre)))
    .slice(0, limit - suggestions.length);

  for (const p of prodFuzzy) {
    if (pushSuggestion('product', p)) return suggestions;
  }

  // 5) Packs fuzzy (Levenshtein)
  const packFuzzy = (packs || [])
    .map((pack) => ({ pack, dist: levenshtein(normalizedTerm, pack._normalizedNombre || normalizeString(pack.nombre).toLowerCase()) }))
    .filter((x) => x.dist <= Math.max(1, Math.floor(normalizedTerm.length * 0.45)))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.pack)
    .filter((pack) => !seen.has('pack::' + (pack.id || pack.nombre)))
    .slice(0, limit - suggestions.length);

  for (const pack of packFuzzy) {
    if (pushSuggestion('pack', pack)) return suggestions;
  }

  return suggestions;
}

function positionSearchSuggestions() {
  const input = document.getElementById('search-input');
  const container = document.getElementById('search-suggestions');
  if (!input || !container || container.style.display === 'none') return;

  const rect = input.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 8; // 8px gap
  const left = rect.left + window.scrollX;
  const width = Math.min(rect.width, Math.max(200, rect.width));

  container.style.position = 'absolute';
  container.style.top = `${top}px`;
  container.style.left = `${left}px`;
  container.style.width = `${width}px`;

  // Prevent overflow to the right edge
  const rightOverflow = (left + width) - (window.innerWidth - 8);
  if (rightOverflow > 0) {
    container.style.left = `${Math.max(8, left - rightOverflow)}px`;
  }
}

function renderSearchSuggestions(suggestions) {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  let container = document.getElementById('search-suggestions');
  if (!container) {
    container = document.createElement('ul');
    container.id = 'search-suggestions';
    container.className = 'search-suggestions';
    container.setAttribute('role', 'listbox');
    document.body.appendChild(container);
  }

  // Reset selection index
  container.dataset.suggestionIndex = '-1';

  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  container.innerHTML = suggestions.map((sugg, idx) => {
    let imgSrc = 'Images/no-image.png';
    let displayName = '';
    let metaHtml = '';
    let typeBadge = '';

    if (sugg.type === 'product') {
      const p = sugg.data;
      imgSrc = p.imagenes?.[0] ? `Images/products/${p.imagenes[0]}` : 'Images/no-image.png';
      displayName = p.cleanName || p.nombre || '';
      const price = typeof p.precio === 'number' ? p.precio : 0;
      const isOnSale = p.oferta && p.descuento > 0 && typeof p.descuento === 'number';
      const finalPrice = isOnSale ? ((price * (1 - p.descuento / 100)).toFixed(2)) : price.toFixed(2);
      metaHtml = `${finalPrice} <img src="Images/Zelle.svg" class="currency-icon price-sm" alt="Zelle">`;
    } else if (sugg.type === 'pack') {
      const pack = sugg.data;
      imgSrc = pack.imagenes?.[0] ? `Images/Packs/${pack.imagenes[0]}` : `Images/pack-placeholder.svg`;
      displayName = pack.nombre || '';
      const price = (typeof pack.precio === 'number' && pack.precio !== 0) ? pack.precio : (typeof pack.precioFinal === 'number' ? pack.precioFinal : 0);
      metaHtml = `${price.toFixed(2)} <img src="Images/Zelle.svg" class="currency-icon price-sm" alt="Zelle">`;
      typeBadge = `<span class="suggestion-type">Pack</span>`;
    } else if (sugg.type === 'category') {
      const cat = sugg.data;
      imgSrc = `Images/Categories/all.jpg`;
      displayName = cat || '';
      metaHtml = `<span class="suggestion-type">Categoría</span>`;
    }

    return `
      <li class="search-suggestion-item" data-index="${idx}" data-type="${sugg.type}" tabindex="-1" role="option" id="search-suggestion-${idx}">
        <img class="suggestion-img" src="${imgSrc}" alt="${displayName}" loading="lazy">
        <div class="suggestion-body">
          <div class="suggestion-name">${displayName} ${typeBadge}</div>
          <div class="suggestion-meta">${metaHtml}</div>
        </div>
      </li>
    `;
  }).join('');

  container.style.display = 'block';
  searchInput.setAttribute('aria-expanded', 'true');

  // Posicionar respecto al input (robusto frente a overflow de padres)
  positionSearchSuggestions();

  // Click / hover handlers
  container.querySelectorAll('.search-suggestion-item').forEach((el, i) => {
    el.addEventListener('mousedown', (ev) => {
      ev.preventDefault(); // evitar blur antes del click
      const s = suggestions[i];
      if (!s) return;
      if (s.type === 'product') {
        showProductDetail(encodeURIComponent(s.data.nombre));
        clearSearchSuggestions();
      } else if (s.type === 'pack') {
        showPackDetail(encodeURIComponent(s.data.nombre));
        clearSearchSuggestions();
      } else if (s.type === 'category') {
        // aplicar filtro por categoría
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        filterByCategory(s.data);
        clearSearchSuggestions();
      }
    });
    el.addEventListener('mouseover', () => {
      container.querySelectorAll('.search-suggestion-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      container.dataset.suggestionIndex = String(i);
    });
  });
}

function clearSearchSuggestions() {
  const container = document.getElementById('search-suggestions');
  const searchInput = document.getElementById('search-input');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
    container.dataset.suggestionIndex = '-1';
  }
  if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
}

// Toggle del menú lateral
function toggleSidebar() {
  if (window.innerWidth > 768) return;

  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  if (!sidebar) return;

  const isOpening = !sidebar.classList.contains("active");

  // Cerrar carrito si está abierto
  closeCart();

  // Alternar estado del sidebar
  sidebar.classList.toggle("active");
  document.body.classList.toggle("sidebar-open", isOpening);

  // Manejar el overlay
  if (isOpening) {
    if (!sidebarOverlay) {
      const overlay = document.createElement("div");
      overlay.id = "sidebar-overlay";
      overlay.className = "sidebar-overlay";
      overlay.onclick = closeSidebar;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.classList.add("active"), 10);
    } else {
      sidebarOverlay.classList.add("active");
    }
  } else {
    closeSidebar();
  }
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  if (sidebar && sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    document.body.classList.remove("sidebar-open");
  }

  if (sidebarOverlay) {
    sidebarOverlay.classList.remove("active");
    setTimeout(() => {
      if (sidebarOverlay && !sidebarOverlay.classList.contains("active")) {
        sidebarOverlay.remove();
      }
    }, 300);
  }
}

// Mostrar modal de carrito vacío
function showEmptyCartModal() {
  const modal = document.getElementById("empty-cart-modal");
  if (!modal) return;

  modal.style.display = "flex";
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
}

// Cerrar modal de carrito vacío
function closeEmptyCartModal() {
  const modal = document.getElementById("empty-cart-modal");
  if (!modal) return;

  modal.classList.remove("active");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}

// Renderizar productos agrupados por categoría
function renderProducts(productsToRender = products) {
  const container = document.getElementById("products-container");

  // Asegurar que el banner esté visible al renderizar productos
  if (bannerContainer) {
    bannerContainer.style.display = "block";
  }

  if (!container) return;
  container.innerHTML = "";

  // Filtrar solo productos disponibles (no renderizar productos con disponibilidad: false)
  const availableProducts = productsToRender.filter(product => product.disponibilidad !== false);

  // ===== RENDERIZAR SECCIÓN "RECIÉN AÑADIDOS" =====
  // Solo mostrar si estamos en home (sin filtro de categoría)
  if (productsToRender === products) {
    if (typeof renderRecentProductsSection === 'function') {
      try {
        renderRecentProductsSection(availableProducts);
      } catch (e) {
        console.warn('[Dynamic] Error renderizando recientes:', e);
      }
    }
  }

  // Agrupar productos por categoría
  const groupedByCategory = {};

  availableProducts.forEach((product) => {
    const category = product.categoria || "Sin categoría";
    if (!groupedByCategory[category]) {
      groupedByCategory[category] = [];
    }
    groupedByCategory[category].push(product);
  });

  // Mantener el orden de las categorías según aparecen en el JSON
  const sortedCategories = Object.keys(groupedByCategory);

  // Crear panel para cada categoría
  sortedCategories.forEach((category) => {
    // ===== APLICAR ORDENAMIENTO DINÁMICO =====
    let categoryProducts = groupedByCategory[category];
    if (typeof applySortingToCategoryProducts === 'function') {
      try {
        categoryProducts = applySortingToCategoryProducts(categoryProducts);
      } catch (e) {
        console.warn('[Dynamic] Error ordenando categoría:', e);
      }
    }
    
    const categoryPanel = document.createElement("div");
    categoryPanel.className = "category-panel";
    categoryPanel.setAttribute("data-category", category);

    // Encabezado de la categoría
    const categoryHeader = document.createElement("div");
    categoryHeader.className = "category-header";
    categoryHeader.innerHTML = `
      <div class="category-header-content">
        <i class="fas fa-${getCategoryIcon(category)}"></i>
        <h2 class="category-title">${category}</h2>
        <span class="category-count">${categoryProducts.length}</span>
      </div>
    `;
    categoryPanel.appendChild(categoryHeader);

    // Grid de productos de esta categoría
    const productsGrid = document.createElement("div");
    productsGrid.className = "category-products-grid";

    // Renderizar cada producto
    categoryProducts.forEach((product) => {
      const displayProduct = product.isGrouped
        ? product.variants[product.currentVariant]
        : product;
      const cleanName = displayProduct.nombre.replace(/'/g, "\\'");

      const productEl = document.createElement("div");
      productEl.className = "product-card";
      // Asignar el id esperado por el módulo de ratings: product-<productId>
      productEl.id = `product-${displayProduct.id}`;

      // ===== AGREGAR CLASE SI ES PRODUCTO RECIENTE =====
      const recentProducts = getRecentProducts ? getRecentProducts(availableProducts) : [];
      if (recentProducts.some(p => p.id === product.id)) {
        productEl.classList.add('is-recent');
      }

      const isOnSale = displayProduct.oferta && displayProduct.descuento > 0;
      const finalPrice = isOnSale
        ? (displayProduct.precio * (1 - displayProduct.descuento / 100)).toFixed(2)
        : displayProduct.precio.toFixed(2);

      // Miniaturas de variantes
      const variantThumbnails = product.isGrouped
        ? `
              <div class="variant-thumbnails-container">
                  <div class="variant-thumbnails">
                      ${product.variants
                        .map(
                          (variant, index) => `
                          <div class="variant-thumb ${
                            index === product.currentVariant ? "active" : ""
                          }" 
                               onclick="changeProductVariant(this, '${
                                 product.baseName
                               }', ${index}, event)">
                              <img src="Images/products/${
                                variant.imagenes[0]
                              }" alt="${
                            variant.variantName
                          }" loading="lazy" decoding="async">
                              <span class="variant-tooltip">${
                                variant.variantName
                              }</span>
                          </div>
                      `
                        )
                        .join("")}
                  </div>
              </div>
          `
        : "";

      productEl.innerHTML = `
              <div class="product-image-container ${
                !displayProduct.disponibilidad ? "unavailable" : ""
              }">
                  <div class="product-badges">
                      ${
                        displayProduct.nuevo
                          ? '<span class="badge nuevo"><i class="fas fa-star"></i> NUEVO</span>'
                          : ""
                      }
                      ${
                        displayProduct.oferta
                          ? '<span class="badge oferta"><i class="fas fa-tag"></i> OFERTA</span>'
                          : ""
                      }
                      ${
                        displayProduct.mas_vendido
                          ? '<span class="badge mas-vendido"><i class="fas fa-trophy"></i> TOP</span>'
                          : ""
                      }
                      ${
                        !displayProduct.disponibilidad
                          ? '<span class="badge agotado"><i class="fas fa-ban"></i> AGOTADO</span>'
                          : ""
                      }
                      ${
                        // ===== BADGES DINÁMICOS =====
                        (function() {
                          if (typeof getProductBadges !== 'function') return '';
                          try {
                            const dynamicBadges = getProductBadges(product);
                            return dynamicBadges.map(badge => 
                              `<span class="badge ${badge.class}"><i class="fas ${badge.icon}"></i> ${badge.label}</span>`
                            ).join('');
                          } catch(e) {
                            return '';
                          }
                        })()
                      }
                  </div>
                  <img src="Images/products/${displayProduct.imagenes[0]}" 
                      class="product-image" 
                      alt="${displayProduct.cleanName}"
                      loading="lazy"
                      decoding="async"
                      onclick="showProductDetail('${encodeURIComponent(
                        displayProduct.nombre
                      )}')">
              </div>
              
              <div class="product-info">
                  <div class="product-category">
                      ${displayProduct.categoria}
                  </div>

                  <h3 class="product-title" onclick="showProductDetail('${encodeURIComponent(
                    displayProduct.nombre
                  )}')">
                      ${displayProduct.cleanName}
                  </h3>
                  ${variantThumbnails}
                  
                  <div class="price-container">
                      ${
                        isOnSale
                          ? `
                          <span class="original-price">${displayProduct.precio.toFixed(
                            2
                          )}<img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
                          <span class="discount-percent">${Math.round(displayProduct.descuento)}% OFF</span>
                      `
                          : ""
                      }
                      <span class="current-price">${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
                  </div>
                  
                  <div class="quantity-section" data-product-name="${displayProduct.nombre}">
                      <!-- Se renderiza dinámicamente por getProductQuantityHTML -->
                  </div>

                  <!-- Contenedor de rating: estrellas, media y votos -->
                  <div class="product-rating">
                      <div class="stars" role="img" aria-label="Valoración"></div>
                      <div class="rating-meta">
                          <span class="avg-rating">0</span>
                          <span class="total-votes">0 votos</span>
                      </div>
                  </div>
              </div>
          `;
      
      // ===== APLICAR ANIMACIÓN SI ES PRODUCTO RECIENTE =====
      if (productEl.classList.contains('is-recent')) {
        if (typeof animateElement === 'function') {
          try {
            animateElement(productEl, 'fade-in');
          } catch(e) {}
        }
      }
      
      // ===== APLICAR PULSO SUTIL A PRODUCTOS NUEVOS =====
      if (displayProduct.nuevo) {
        if (typeof applyNewProductBorderAnimation === 'function') {
          try {
            // Stagger muy pequeño (máximo 300ms)
            const delay = Math.random() * 200;
            setTimeout(() => {
              applyNewProductBorderAnimation(productEl);
            }, delay);
          } catch(e) {}
        }
      }
      
      productsGrid.appendChild(productEl);
    });

    categoryPanel.appendChild(productsGrid);
    container.appendChild(categoryPanel);
  });

  // ===== ACTUALIZAR SISTEMA DINÁMICO (LAYOUT, ETC) =====
  if (typeof updateDynamicSystem === 'function') {
    try {
      updateDynamicSystem();
    } catch (e) {
      console.warn('[Dynamic] Error actualizando sistema:', e);
    }
  }

  // Inicializar widgets de rating para productos renderizados (si está disponible)
  if (window.initRatings) {
    try {
      window.initRatings();
    } catch (e) {
      console.warn("initRatings fallo:", e);
    }
  }

  // Actualizar todas las secciones de cantidad dinámicamente
  updateAllProductQuantitySections();
}

function changeProductVariant(thumbElement, baseName, variantIndex, event) {
  if (event) event.stopPropagation();

  const productCard = thumbElement.closest(".product-card");
  const product = products.find((p) => p.baseName === baseName);

  if (!product || !product.isGrouped) return;

  // Actualizar la variante actual
  product.currentVariant = variantIndex;
  const variant = product.variants[variantIndex];
  const isOnSale = variant.oferta && variant.descuento > 0;
  const finalPrice = isOnSale
    ? (variant.precio * (1 - variant.descuento / 100)).toFixed(2)
    : variant.precio.toFixed(2);

  // Actualizar la imagen principal
  productCard.querySelector(
    ".product-image"
  ).src = `Images/products/${variant.imagenes[0]}`;
  productCard.querySelector(".product-image").alt = variant.cleanName;
  productCard
    .querySelector(".product-image")
    .setAttribute(
      "onclick",
      `showProductDetail('${encodeURIComponent(variant.nombre)}')`
    );

  // Actualizar el contenedor de imagen (estado disponible/no disponible)
  const imageContainer = productCard.querySelector(".product-image-container");
  if (!variant.disponibilidad) {
    imageContainer.classList.add("unavailable");
  } else {
    imageContainer.classList.remove("unavailable");
  }

  // Actualizar los badges
  const badgesContainer = imageContainer.querySelector(".product-badges");
  const badgesHTML = `
        ${
          variant.nuevo
            ? '<span class="badge nuevo"><i class="fas fa-star"></i> NUEVO</span>'
            : ""
        }
        ${
          variant.oferta
            ? '<span class="badge oferta"><i class="fas fa-tag"></i> OFERTA</span>'
            : ""
        }
        ${
          variant.mas_vendido
            ? '<span class="badge mas-vendido"><i class="fas fa-trophy"></i> TOP</span>'
            : ""
        }
        ${
          !variant.disponibilidad
            ? '<span class="badge agotado"><i class="fas fa-ban"></i> AGOTADO</span>'
            : ""
        }
    `;
  badgesContainer.innerHTML = badgesHTML;

  // Actualizar el título
  productCard.querySelector(".product-title").textContent = variant.cleanName;
  productCard
    .querySelector(".product-title")
    .setAttribute(
      "onclick",
      `showProductDetail('${encodeURIComponent(variant.nombre)}')`
    );

  // Actualizar los precios
  const priceContainer = productCard.querySelector(".price-container");
  const priceHTML = `
        ${
          isOnSale
            ? `
            <span class="original-price">${variant.precio.toFixed(
              2
            )}<img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
            <span class="discount-percent">${Math.round(variant.descuento)}% OFF</span>
        `
            : ""
        }
        <span class="current-price">${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
    `;
  priceContainer.innerHTML = priceHTML;

  // Actualizar la sección de cantidad (botón o contador)
  const quantitySectionEl = productCard.querySelector(".quantity-section");
  if (quantitySectionEl) {
    quantitySectionEl.innerHTML = getProductQuantityHTML(variant.nombre, variant);
  }

  // Actualizar las miniaturas activas
  const thumbs = productCard.querySelectorAll(".variant-thumb");
  thumbs.forEach((thumb, index) => {
    if (index === variantIndex) {
      thumb.classList.add("active");
    } else {
      thumb.classList.remove("active");
    }
  });
}

/**
 * Renderiza los productos más vendidos en una sección horizontal con scroll
 */
function renderBestSellers() {
  const bestSellersScroll = document.getElementById("best-sellers-scroll");

  if (!bestSellersScroll) return;

  // Filtrar solo productos con mas_vendido: true
  let bestSellers = products.filter(
    (product) => product.mas_vendido === true && productIsAvailable(product)
  );

  // ===== APLICAR ORDENAMIENTO DINÁMICO A BEST SELLERS =====
  if (bestSellers.length > 0 && typeof sortBestSellersDynamic === 'function') {
    try {
      bestSellers = sortBestSellersDynamic(bestSellers);
    } catch (e) {
      console.warn('[Dynamic] Error ordenando best sellers:', e);
    }
  }

  // Si no hay productos, ocultar la sección
  if (bestSellers.length === 0) {
    document.querySelector(".best-sellers-section").style.display = "none";
    return;
  }

  // Limpiar el contenedor
  bestSellersScroll.innerHTML = "";

  // Crear cards para cada producto más vendido
  bestSellers.forEach((product, index) => {
    const displayProduct = product.isGrouped
      ? product.variants[product.currentVariant]
      : product;
    const isOnSale = displayProduct.oferta && displayProduct.descuento > 0;
    const finalPrice = isOnSale
      ? (displayProduct.precio * (1 - displayProduct.descuento / 100)).toFixed(
          2
        )
      : displayProduct.precio.toFixed(2);

    const card = document.createElement("div");
    card.className = "best-seller-card";
    card.style.animationDelay = `${index * 0.05}s`;
    card.onclick = () =>
      showProductDetail(encodeURIComponent(displayProduct.nombre));

    card.innerHTML = `
            <div class="best-seller-image-container">
                <span class="best-seller-badge">
                    <i class="fas fa-fire"></i> TOP
                </span>
                 <img src="Images/products/${displayProduct.imagenes[0]}" 
                     class="best-seller-image" 
                     alt="${
                       displayProduct.nombre
                     }" loading="lazy" decoding="async">
            </div>
            
            <div class="best-seller-info">
                <div class="best-seller-category">
                    ${displayProduct.categoria}
                </div>
                
                <h3 class="best-seller-title">
                    ${displayProduct.nombre}
                </h3>
                
                <div class="best-seller-price">
                    ${
                      isOnSale
                        ? `
                        <span class="best-seller-price-original">${displayProduct.precio.toFixed(
                          2
                        )} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-xs"></span>
                        <span class="best-seller-discount">-${Math.round(displayProduct.descuento)}%</span>
                    `
                        : ""
                    }
                    <span class="best-seller-price-current">${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-xs"></span>
                </div>
            </div>
        `;

    bestSellersScroll.appendChild(card);
  });
}

// Función para renderizar categorías en forma circular
function renderCategoriesCircle() {
  const categoriesCircleScroll = document.getElementById("categories-circle-scroll");
  const categoriesSectionCircle = document.querySelector(".categories-circle-section");

  if (!categoriesCircleScroll || !categoriesSectionCircle) return;

  // Comenzar con "All"/"Todo"
  const displayCategories = ["Todo", ...categories.filter(cat => cat !== "Todo")];

  // Si no hay categorías, ocultar la sección
  if (displayCategories.length === 0) {
    categoriesSectionCircle.style.display = "none";
    return;
  }

  // Limpiar el contenedor
  categoriesCircleScroll.innerHTML = "";

  // Crear cards para cada categoría
  displayCategories.forEach((category, index) => {
    // Contar productos en cada categoría (solo disponibles)
    let productsInCategory;
    if (category === "Todo") {
      productsInCategory = products.filter(productIsAvailable).length;
    } else {
      productsInCategory = products.filter(
        (p) => p.categoria === category && productIsAvailable(p)
      ).length;
    }

    // Mapeo de nombres de categorías a nombres de archivos de imagen
    const categoryImageMap = {
      "Todo": "all.jpg",
      "Despensa": "despensa.jpg",
      "Confitura": "confitura.jpg",
      "Bebidas": "bebidas.jpg",
      "Lácteos": "lacteos.jpg",
      "Carnes": "carnes.jpg",
      "Verduras": "verduras.jpg",
      "Frutas": "frutas.jpg",
      "Panadería": "panaderia.jpg",
      "Snacks": "snacks.jpg",
      "Higiene": "higiene.jpg",
      "Limpieza": "limpieza.jpg",
      "Mascotas": "mascotas.jpg",
      "Electrónica": "electronica.jpg",
      "Hogar": "hogar.jpg",
      "Deportes": "deportes.jpg",
      "Belleza": "belleza.jpg",
      "Farmacia": "farmacia.jpg",
      "Accesorios": "accesorios.jpg"
    };

    // Obtener nombre de la imagen o usar uno por defecto
    const imageName = categoryImageMap[category] || `${category.toLowerCase().replace(/\s+/g, "_")}.jpg`;

    const card = document.createElement("div");
    card.className = "category-circle-card";
    card.style.animationDelay = `${index * 0.05}s`;
    
    // Hacer clickeable para filtrar por categoría
    card.onclick = () => filterByCategory(category);

    card.innerHTML = `
      <div class="category-circle">
        <img 
          src="Images/Categories/${imageName}" 
          alt="${category}"
          class="category-circle-image"
          loading="lazy"
          decoding="async"
          onerror="this.src='Images/categories-placeholder.jpg'"
        >
        ${productsInCategory > 0 ? `<div class="category-circle-badge">${productsInCategory}</div>` : ''}
      </div>
      <p class="category-circle-name">${category}</p>
    `;

    categoriesCircleScroll.appendChild(card);
  });
}

// Mostrar detalle del producto con precios corregidos
function showProductDetail(productName) {
  window.scrollTo({ top: 0 });
  const decodedName = decodeURIComponent(productName);

  // Ocultar el banner al entrar al detalle del producto
  if (bannerContainer) {
    bannerContainer.style.display = "none"; // <-- OCULTA EL BANNER
  }

  // Ocultar la sección de best-sellers al entrar al detalle del producto
  if (bestSellersSection) {
    bestSellersSection.style.display = "none"; // <-- OCULTA LOS BEST-SELLERS
  }

  // Ocultar la sección de categorías circulares al entrar al detalle del producto
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  if (categoriesCircleSection) {
    categoriesCircleSection.style.display = "none"; // <-- OCULTA LAS CATEGORÍAS CIRCULARES
  }

  // Ocultar el panel de packs al entrar al detalle del producto
  const categoryCardSection = document.getElementById("category-card-section");
  if (categoryCardSection) {
    categoryCardSection.style.display = "none"; // <-- OCULTA EL CATEGORY CARD
  }

  // Buscar el producto principal
  let product = products.find((p) => p.nombre === decodedName);
  let isVariant = false;
  let mainProduct = null;
  let variantIndex = 0;

  if (!product) {
    mainProduct = products.find(
      (p) => p.isGrouped && p.variants.some((v) => v.nombre === decodedName)
    );

    if (mainProduct) {
      isVariant = true;
      variantIndex = mainProduct.variants.findIndex(
        (v) => v.nombre === decodedName
      );
      product = mainProduct.variants[variantIndex];
    } else {
      window.location.hash = "";
      hideProductDetail();
      return;
    }
  } else if (product.isGrouped) {
    mainProduct = product;
    product = product.variants[0];
    variantIndex = 0;
  }

  window.location.hash = encodeURIComponent(product.nombre);

  const detailContainer = document.getElementById("product-detail");
  const productsContainer = document.getElementById("products-container");

  if (!detailContainer || !productsContainer) return;

  const isOnSale = product.oferta && product.descuento > 0;
  const finalPrice = isOnSale
    ? (product.precio * (1 - product.descuento / 100)).toFixed(2)
    : product.precio.toFixed(2);
  const priceSave = isOnSale ? (product.precio - finalPrice).toFixed(2) : 0;

  // Obtener productos sugeridos mejorados
  const suggestedProducts = getSuggestedProducts(mainProduct || product, 6); // Mostrar 6 sugerencias

  // Miniaturas de variantes
  const variantThumbnails = mainProduct?.isGrouped
    ? `
        <div class="variant-thumbnails-detail-container">
            <p class="variant-title">Variantes disponibles:</p>
            <div class="variant-thumbnails-detail">
                ${mainProduct.variants
                  .map(
                    (v, index) => `
                    <div class="variant-thumb ${
                      index === variantIndex ? "active" : ""
                    }" 
                         onclick="changeDetailVariant('${
                           mainProduct.baseName
                         }', ${index}, event)">
                        <img src="Images/products/${v.imagenes[0]}" alt="${
                      v.variantName
                    }" loading="lazy" decoding="async">
                        <span class="variant-tooltip">${v.variantName}</span>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `
    : "";

  // Badges
  const badges = [];
  if (product.nuevo)
    badges.push(
      '<span class="detail-badge nuevo"><i class="fas fa-star"></i> Nuevo</span>'
    );
  if (product.oferta)
    badges.push(
      `<span class="detail-badge oferta"><i class="fas fa-tag"></i> ${Math.round(product.descuento)}% OFF</span>`
    );
  if (product.mas_vendido)
    badges.push(
      '<span class="detail-badge mas-vendido"><i class="fas fa-trophy"></i> Más Vendido</span>'
    );
  if (!product.disponibilidad)
    badges.push(
      '<span class="detail-badge agotado"><i class="fas fa-ban"></i> AGOTADO</span>'
    );

  // Especificaciones
  const specs = [
    `<li><strong>Categoría</strong> ${product.categoria}</li>`,
    `<li><strong>Disponibilidad</strong> ${
      product.disponibilidad ? "En stock" : "Agotado"
    }</li>`,
    ...(product.especificaciones || []).map(
      (spec) => `<li><strong>${spec.key}</strong> ${spec.value}</li>`
    ),
  ];

  // Sección de productos sugeridos mejorada
  const suggestedProductsHTML =
    suggestedProducts.length > 0
      ? `
        <div class="suggested-products-section">
            <div class="section-header">
                <h3 class="section-title">Productos relacionados</h3>
                <div class="section-divider"></div>
            </div>
            <div class="suggested-products-carousel">
                ${suggestedProducts
                  .map((suggested) => {
                    const isOnSaleSuggested =
                      suggested.oferta && suggested.descuento > 0;
                    const finalPriceSuggested = isOnSaleSuggested
                      ? (
                          suggested.precio *
                          (1 - suggested.descuento / 100)
                        ).toFixed(2)
                      : suggested.precio.toFixed(2);

                    return `
                        <div class="suggested-item">
                            <div class="suggested-badges">
                                ${
                                  suggested.nuevo
                                    ? '<span class="badge nuevo">NUEVO</span>'
                                    : ""
                                }
                                ${
                                  suggested.oferta
                                    ? '<span class="badge oferta">OFERTA</span>'
                                    : ""
                                }
                                ${
                                  suggested.mas_vendido
                                    ? '<span class="badge mas-vendido">TOP</span>'
                                    : ""
                                }
                            </div>
                            <div class="suggested-image" onclick="showProductDetail('${encodeURIComponent(
                              suggested.nombre
                            )}')">
                                <img src="Images/products/${
                                  suggested.imagenes[0]
                                }" alt="${
                      suggested.cleanName || suggested.nombre
                    }" loading="lazy" decoding="async">
                            </div>
                            <div class="suggested-details">
                                <h4 class="suggested-name" onclick="showProductDetail('${encodeURIComponent(
                                  suggested.nombre
                                )}')">
                                    ${suggested.cleanName || suggested.nombre}
                                </h4>
                                <div class="suggested-price">
                                    ${
                                      isOnSaleSuggested
                                        ? `
                                        <span class="original-price">${suggested.precio.toFixed(
                                          2
                                        )} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
                                        <span class="current-price">${finalPriceSuggested} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
                                    `
                                        : `
                                        <span class="current-price">${finalPriceSuggested} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-sm"></span>
                                    `
                                    }
                                </div>
                                <button class="add-to-cart-mini" onclick="addToCart('${
                                  suggested.nombre
                                }', false, event)">
                                    <i class="fas fa-cart-plus"></i> Añadir
                                </button>
                            </div>
                        </div>
                    `;
                  })
                  .join("")}
            </div>
        </div>
    `
      : "";

  detailContainer.innerHTML = `
        <div class="detail-container">
            <div class="detail-gallery">
                <div class="main-image-container">
                    <img src="Images/products/${
                      product.imagenes[0]
                    }" class="main-image" alt="${
    product.cleanName
  }" id="main-product-image" loading="lazy" decoding="async">
                </div>
            </div>
            
            <div class="detail-info">
                <h1 class="detail-title">${product.cleanName}</h1>
                ${variantThumbnails}
                ${
                  badges.length
                    ? `<div class="detail-badges">${badges.join("")}</div>`
                    : ""
                }
                
                <!-- Rating estilo Amazon -->
                <div class="detail-rating" data-product-id="${product.id}">
                    <div class="detail-rating-top">
                        <div class="stars"></div>
                        <div class="detail-rating-meta">
                            <span class="avg-rating">0</span>
                            <span class="total-votes">0 votos</span>
                        </div>
                    </div>
                    <div class="detail-rate-cta"><small>¿Te gustó el producto? Déjanos tu valoración</small></div>
                </div>

                <div class="price-section">
                    ${
                      isOnSale
                        ? `
                        <div class="price-with-discount">
                        PVPR:
                            <span class="price-original">${product.precio.toFixed(
                              2
                            )} </span>
                        </div>
                        <span class="price-current">Precio: ${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-lg"></span>
                        <div class="price-save">Ahorras ${priceSave} </div>
                    `
                        : `
                        <span class="price-current">Precio: ${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-lg"></span>
                    `
                    }
                </div>

                <!-- AVISO DE COSTO DE DOMICILIO -->
                <div class="delivery-info">
                    <span
                        style="display:block; padding:12px 16px; background:#ffffff; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); font-size:1em; color:#2c2c2c; line-height:1.55;">
                        <span class="envio-badge"> ✓ Envío </span>

                        <i class="fas fa-truck-fast"></i>
                        <br>
                        Envío gratuito dentro del municipio. Entrega en 24–48 horas. Para envíos
                        fuera del municipio, el costo del domicilio se coordina al confirmar el
                        pedido.
                    </span>

                </div>
                <!-- FIN AVISO DOMICILIO -->
                
                <div class="quantity-section">
                    <label class="quantity-label">Cantidad:</label>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="adjustDetailQuantity(-1, event)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="quantity-display" id="detail-quantity">1</span>
                        <button class="quantity-btn" onclick="adjustDetailQuantity(1, event)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>

                <button class="add-to-cart-btn ${
                  !product.disponibilidad ? "disabled" : ""
                }" 
                        onclick="addToCart('${product.nombre}', true, event)"
                        ${!product.disponibilidad ? "disabled" : ""}>
                    <i class="fas fa-${
                      !product.disponibilidad ? "lock" : "cart-plus"
                    }"></i>
                    ${
                      !product.disponibilidad
                        ? "Producto Agotado"
                        : "Añadir a la cesta"
                    }
                </button>
                
                <div class="product-description">
                    <h4 class="description-title"><i class="fas fa-align-left"></i> Descripción</h4>
                    <div class="description-content">
                        ${formatProductDescription(product.descripcion)}
                    </div>
                </div>
                
                <div class="product-specs">
                    <h3 class="specs-title"><i class="fas fa-list-ul"></i> Especificaciones</h3>
                    <ul class="specs-list">
                        ${specs.join("")}
                    </ul>
                </div>
            </div>
            
            <div class="back-btn-container">
                <button class="back-btn" onclick="hideProductDetail()">
                    <i class="fas fa-arrow-left"></i> Volver a productos
                </button>
            </div>
            
            ${suggestedProductsHTML}
        </div>
    `;

  productsContainer.style.display = "none";
  detailContainer.style.display = "block";
  currentProduct = product;

  // Inicializar carrusel después de renderizar
  setTimeout(() => {
    initSuggestedProductsCarousel();
    // Inicializar ratings dentro del detalle (si el módulo está cargado)
    if (window.initRatings) {
      try { window.initRatings(); } catch (e) { console.warn('initRatings en detail fallo', e); }
    }
  }, 100);
}

function changeDetailVariant(baseName, variantIndex, event) {
  if (event) event.stopPropagation();

  const product = products.find((p) => p.baseName === baseName);

  if (product && product.isGrouped && product.variants[variantIndex]) {
    const variant = product.variants[variantIndex];
    window.location.hash = encodeURIComponent(variant.nombre);
    showProductDetail(variant.nombre);
  }
}

function getSuggestedProducts(currentProduct, count = 6) {
  if (!currentProduct || !products.length) return [];

  const baseProduct = currentProduct.isGrouped
    ? currentProduct
    : currentProduct;
  const currentCategory = baseProduct.categoria;

  // Excluir el producto actual y sus variantes
  const excludedIds = baseProduct.isGrouped
    ? [...baseProduct.variants.map((v) => v.id), baseProduct.id]
    : [baseProduct.id];

  // Primero: productos de la misma categoría
  const sameCategory = products.filter(
    (p) =>
      p.categoria === currentCategory &&
      !excludedIds.includes(p.id) &&
      p.id !== baseProduct.id
  );

  // Segundo: productos destacados de otras categorías
  const featuredProducts = products.filter(
    (p) =>
      p.categoria !== currentCategory &&
      !excludedIds.includes(p.id) &&
      (p.mas_vendido || p.nuevo || p.oferta)
  );

  // Combinar y ordenar
  const suggested = [
    ...sameCategory.map((p) => ({ product: p, score: 3 })),
    ...featuredProducts.map((p) => ({ product: p, score: 1 })),
  ];

  // Aleatorizar y limitar
  return suggested
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.product.mas_vendido !== a.product.mas_vendido)
        return b.product.mas_vendido ? 1 : -1;
      if (b.product.oferta !== a.product.oferta)
        return b.product.oferta ? 1 : -1;
      return Math.random() - 0.5;
    })
    .slice(0, count)
    .map((item) => item.product);
}

// Carrusel de productos sugeridos
function initSuggestedProductsCarousel() {
  const carousel = document.querySelector(".suggested-products-carousel");
  if (!carousel) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "carousel-nav prev hidden";
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.onclick = () => scrollCarousel(-1);

  const nextBtn = document.createElement("button");
  nextBtn.className = "carousel-nav next";
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.onclick = () => scrollCarousel(1);

  carousel.parentElement.insertBefore(prevBtn, carousel);
  carousel.parentElement.insertBefore(nextBtn, carousel.nextSibling);

  // Actualizar visibilidad de botones
  function updateNavButtons() {
    const { scrollLeft, scrollWidth, clientWidth } = carousel;
    prevBtn.classList.toggle("hidden", scrollLeft === 0);
    nextBtn.classList.toggle(
      "hidden",
      scrollLeft >= scrollWidth - clientWidth - 1
    );
  }

  // Función para desplazar el carrusel
  function scrollCarousel(direction) {
    const itemWidth = carousel.querySelector(".suggested-item").offsetWidth;
    const scrollAmount = (itemWidth + 20) * direction; // 20px es el gap

    carousel.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  }

  // Event listeners
  carousel.addEventListener("scroll", updateNavButtons);
  updateNavButtons();

  // Touch events para móviles
  let isDragging = false;
  let startX;
  let scrollLeft;

  carousel.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
    carousel.style.cursor = "grabbing";
    carousel.style.scrollBehavior = "auto";
  });

  carousel.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 2;
    carousel.scrollLeft = scrollLeft - walk;
  });

  carousel.addEventListener("mouseup", () => {
    isDragging = false;
    carousel.style.cursor = "grab";
    carousel.style.scrollBehavior = "smooth";
    updateNavButtons();
  });

  carousel.addEventListener("mouseleave", () => {
    isDragging = false;
    carousel.style.cursor = "grab";
  });

  // Touch events
  carousel.addEventListener("touchstart", (e) => {
    isDragging = true;
    startX = e.touches[0].pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
    carousel.style.scrollBehavior = "auto";
  });

  carousel.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - carousel.offsetLeft;
    const walk = (x - startX) * 2;
    carousel.scrollLeft = scrollLeft - walk;
  });

  carousel.addEventListener("touchend", () => {
    isDragging = false;
    carousel.style.scrollBehavior = "smooth";
    updateNavButtons();
  });

  // Actualizar al redimensionar
  window.addEventListener("resize", updateNavButtons);
}

// Función auxiliar para formatear la descripción
function formatProductDescription(description) {
  if (!description)
    return '<p class="no-description">No hay descripción disponible</p>';

  // Dividir en oraciones considerando múltiples signos de puntuación
  const sentences = description
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  return sentences
    .map((sentence) => {
      const trimmedSentence = sentence.trim();
      // Destacar oraciones importantes
      const isImportant = /(garantiza|ideal|perfecto|exclusiv|especial)/i.test(
        trimmedSentence
      );

      return `
            <div class="description-sentence ${
              isImportant ? "important-sentence" : ""
            }">
                <div class="sentence-icon">
                    <i class="fas ${
                      isImportant ? "fa-star" : "fa-angle-right"
                    }"></i>
                </div>
                <div class="sentence-text">
                    ${trimmedSentence}
                    ${
                      !trimmedSentence.endsWith(".") &&
                      !trimmedSentence.endsWith("!") &&
                      !trimmedSentence.endsWith("?")
                        ? "."
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");
}

// Función auxiliar para cambiar imagen principal
function changeMainImage(imgSrc) {
  const mainImg = document.getElementById("main-product-image");
  if (mainImg) {
    mainImg.src = `Images/products/${imgSrc}`;
    mainImg.style.opacity = "0";
    setTimeout(() => {
      mainImg.style.opacity = "1";
      mainImg.style.transition = "opacity 0.3s ease";
    }, 10);
  }
}

// Ocultar detalle
// Función para ocultar el detalle del producto
function hideProductDetail() {
  const productsContainer = document.getElementById("products-container");
  const detailContainer = document.getElementById("product-detail");

  if (productsContainer) {
    productsContainer.style.display = "grid";
    productsContainer.style.animation = "fadeIn 0.4s ease-out";
  }

  // Mostrar el banner cuando se vuelve a la página principal
  if (bannerContainer) {
    bannerContainer.style.display = "block"; // <-- MUESTRA EL BANNER
  }

  // Mostrar la sección de best-sellers cuando se vuelve a la página principal
  if (bestSellersSection) {
    bestSellersSection.style.display = "block"; // <-- MUESTRA LOS BEST-SELLERS
  }

  // Mostrar la sección de categorías circulares cuando se vuelve a la página principal
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  if (categoriesCircleSection) {
    categoriesCircleSection.style.display = "block"; // <-- MUESTRA LAS CATEGORÍAS CIRCULARES
  }

  // Mostrar el panel de packs cuando se vuelve a la página principal
  const categoryCardSection = document.getElementById("category-card-section");
  if (categoryCardSection) {
    categoryCardSection.style.display = "block"; // <-- MUESTRA EL CATEGORY CARD
  }

  if (detailContainer) {
    detailContainer.style.display = "none";
    detailContainer.innerHTML = "";
  }

  currentProduct = null;
  window.location.hash = "";
}

// Carrito
function addToCart(productName, fromDetail = false, event) {
  if (event) event.stopPropagation();

  const decodedName = decodeURIComponent(productName);
  const product =
    products.find((p) => p.nombre === decodedName) ||
    products
      .flatMap((p) => (p.isGrouped ? p.variants : []))
      .find((v) => v.nombre === decodedName);

  if (!product) return;

  // Validar disponibilidad
  if (!product.disponibilidad) {
    showCartNotification("Este producto está agotado", 1, "error");
    return;
  }

  let quantity;
  if (fromDetail) {
    const quantityElement = document.getElementById("detail-quantity");
    quantity = quantityElement ? parseInt(quantityElement.textContent) || 1 : 1;
  } else {
    // Modificado para manejar productos con variantes
    const productCard = event.target.closest(".product-card");
    if (!productCard) return;

    const quantityElement = productCard.querySelector(".product-quantity");
    quantity = quantityElement ? parseInt(quantityElement.textContent) || 1 : 1;
  }

  const existingItem = cart.find((item) => {
    const itemData = item.product || item.pack;
    return itemData && itemData.nombre === decodedName;
  });
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ product: product, quantity: quantity });
  }

  updateCart();
  saveCart();
  showCartNotification(product.cleanName || product.nombre, quantity);
  
  // Actualizar la sección de cantidad en la tarjeta del producto
  updateProductQuantitySection(product.nombre);
}

function updateCart() {
  const cartItems = document.getElementById("cart-items");
  const totalElement = document.getElementById("total");
  const emptyPanel = document.getElementById("empty-cart-panel");
  const cartSidebar = document.getElementById("cart");

  if (!cartItems || !totalElement || !emptyPanel || !cartSidebar) return;

  cartItems.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartSidebar.classList.add("empty");
  } else {
    cartSidebar.classList.remove("empty");

    cart.forEach((item, index) => {
      // Determinar si es pack o producto
      const isPack = item.isPack || item.pack;
      const itemData = isPack ? item.pack : item.product;
      
      if (!itemData) return;
      
      // Calcular precio con descuento si aplica
      const isOnSale = itemData.oferta && itemData.descuento > 0;
      const unitPrice = isOnSale
        ? itemData.precio * (1 - itemData.descuento / 100)
        : itemData.precio;

      const itemTotal = unitPrice * item.quantity;
      total += itemTotal;

      // Determinar imagen (packs usan imagen, productos usan imagenes[0])
      const imageSrc = isPack 
        ? `Images/Packs/${itemData.imagen}`
        : `Images/products/${itemData.imagenes[0]}`;
      
      const badgeType = isPack ? 'pack' : 'product';

      const itemEl = document.createElement("div");
      itemEl.className = `cart-item cart-item-${badgeType}`;
      itemEl.innerHTML = `
                ${
                  isOnSale
                    ? '<span class="cart-item-badge oferta">OFERTA</span>'
                    : ""
                }
                <img src="${imageSrc}" alt="${itemData.nombre}">
                <div class="cart-item-info">
                    <p>${itemData.nombre}</p>
                    <p class="cart-item-type">${isPack ? '[Pack]' : '[Producto]'}</p>
                    <p>$${unitPrice.toFixed(2)} c/u</p>
                    <div class="cart-item-controls">
                        <button class="cart-quantity-btn decrease-btn" onclick="updateCartQuantity(${index}, -1, event)">-</button>
                        <span class="cart-quantity">${item.quantity}</span>
                        <button class="cart-quantity-btn increase-btn" onclick="updateCartQuantity(${index}, 1, event)">+</button>
                        <button class="delete-item-btn" onclick="removeFromCart(${index}, event)">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <p>Total: $${itemTotal.toFixed(2)}</p>
                </div>
            `;
      cartItems.appendChild(itemEl);
    });

    totalElement.textContent = total.toFixed(2);
  }

  updateCartCount();
  
  // Actualizar las secciones de cantidad en los productos visibles
  updateAllProductQuantitySections();
}

/**
 * Agregar un pack al carrito
 */
function addPackToCart(packName, event) {
  if (event) event.stopPropagation();

  const decodedName = decodeURIComponent(packName);
  const pack = packs.find((p) => p.nombre === decodedName);

  if (!pack) return;

  // Validar disponibilidad
  if (!pack.disponible) {
    showCartNotification("Este pack está agotado", 1, "error");
    return;
  }

  // Buscar si el pack ya está en el carrito
  const existingItem = cart.find((item) => item.pack && item.pack.nombre === decodedName);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    // Agregar pack con estructura similar a productos
    cart.push({ 
      pack: pack, 
      quantity: 1,
      isPack: true  // Flag para identificar packs
    });
  }

  updateCart();
  saveCart();
  showCartNotification(pack.nombre, 1);
}

function removeFromCart(index, event) {
  if (event) event.stopPropagation();

  if (cart[index]) {
    const isPack = cart[index].isPack || cart[index].pack;
    const itemName = isPack ? cart[index].pack.nombre : cart[index].product.nombre;
    cart.splice(index, 1);
    updateCart();
    saveCart();

    // Mostrar notificación de eliminación
    showRemoveNotification(itemName);
  }
}

function showRemoveNotification(productName) {
  const notification = document.createElement("div");
  notification.className = "cart-notification removed";
  notification.innerHTML = `
        <p>${productName} eliminado del carrito</p>
    `;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("show"), 10);
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function updateCartQuantity(index, change, event) {
  if (event) event.stopPropagation();

  if (cart[index]) {
    cart[index].quantity += change;
    if (cart[index].quantity < 1) cart.splice(index, 1);
    updateCart();
    saveCart();
  }
}

function showCartNotification(productName, quantity, type = "success") {
  const notification = document.createElement("div");
  notification.className = `cart-notification notification-${type}`;

  let message = "";
  if (type === "error") {
    message = `<i class="fas fa-exclamation-circle"></i> ${productName}`;
  } else {
    message = `<i class="fas fa-check-circle"></i> ${quantity}x ${productName} añadido al carrito`;
  }

  notification.innerHTML = `<p>${message}</p>`;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("show"), 10);
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Vaciar completamente el carrito
function clearCart() {
  cart = [];
  localStorage.removeItem("cart");
  updateCart();
  updateCartCount();
}

// Funciones auxiliares
function adjustQuantity(btn, change, productName, event) {
  if (event) event.stopPropagation();
  const quantityElement = document.getElementById(`quantity-${productName}`);
  if (quantityElement) {
    let quantity = parseInt(quantityElement.textContent) || 1;
    quantity = Math.max(1, quantity + change);
    quantityElement.textContent = quantity;
  }
}

function adjustDetailQuantity(change, event) {
  if (event) event.stopPropagation();
  const quantityElement = document.getElementById("detail-quantity");
  if (quantityElement) {
    let quantity = parseInt(quantityElement.textContent) || 1;
    quantity = Math.max(1, quantity + change);
    quantityElement.textContent = quantity;
  }
}

function toggleCart() {
  const cart = document.getElementById("cart");
  const cartOverlay = document.getElementById("cart-overlay");

  if (!cart) return;

  const isOpening = !cart.classList.contains("active");

  // Cerrar sidebar si está abierto
  closeSidebar();

  // Alternar estado del carrito
  cart.classList.toggle("active");
  document.body.classList.toggle("cart-open", isOpening);

  // Manejar el overlay
  if (isOpening) {
    if (!cartOverlay) {
      const overlay = document.createElement("div");
      overlay.id = "cart-overlay";
      overlay.className = "cart-overlay";
      overlay.onclick = closeCart;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.classList.add("active"), 10);
    } else {
      cartOverlay.classList.add("active");
    }
  } else {
    closeCart();
  }
}

function closeCart() {
  const cart = document.getElementById("cart");
  const cartOverlay = document.getElementById("cart-overlay");

  if (cart && cart.classList.contains("active")) {
    cart.classList.remove("active");
    document.body.classList.remove("cart-open");
  }

  if (cartOverlay) {
    cartOverlay.classList.remove("active");
    setTimeout(() => {
      if (cartOverlay && !cartOverlay.classList.contains("active")) {
        cartOverlay.remove();
      }
    }, 300);
  }
}

function updateCartCount() {
  const countElement = document.getElementById("cart-count");
  if (countElement) {
    const count = cart.reduce((acc, item) => acc + item.quantity, 0);
    countElement.textContent = count;
  }
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/**
 * Obtiene la cantidad de un producto en el carrito
 * @param {string} productName - Nombre del producto
 * @returns {number} Cantidad en carrito o 0
 */
function getProductCartQuantity(productName) {
  const item = cart.find(cartItem => {
    const itemData = cartItem.product || cartItem.pack;
    return itemData && itemData.nombre === productName;
  });
  return item ? item.quantity : 0;
}

/**
 * Genera el HTML para la sección de cantidad: contador o botón de agregar
 * @param {string} productName - Nombre del producto
 * @param {object} displayProduct - Datos del producto a mostrar
 * @returns {string} HTML del contador o botón
 */
function getProductQuantityHTML(productName, displayProduct) {
  const quantity = getProductCartQuantity(productName);
  
  if (quantity === 0) {
    // Mostrar botón de agregar
    return `
      <button class="add-to-cart ${!displayProduct.disponibilidad ? "disabled" : ""}" 
              onclick="addToCart('${displayProduct.nombre}', false, event)"
              ${!displayProduct.disponibilidad ? "disabled" : ""}>
        <i class="fas fa-${!displayProduct.disponibilidad ? "lock" : "cart-plus"}"></i>
        <span>${!displayProduct.disponibilidad ? "Agotado" : "Añadir a la cesta"}</span>
      </button>
    `;
  } else {
    // Mostrar contador con botones + y -
    const isTrash = quantity === 1;
    const decreaseIcon = isTrash ? 'trash-alt' : 'minus';
    const decreaseClass = isTrash ? 'quantity-btn decrease-btn trash-icon' : 'quantity-btn decrease-btn';
    
    return `
      <div class="quantity-counter">
        <button class="${decreaseClass}" 
                onclick="decreaseProductQuantity('${displayProduct.nombre}', event)"
                title="${isTrash ? 'Eliminar del carrito' : 'Disminuir cantidad'}">
          <i class="fas fa-${decreaseIcon}"></i>
        </button>
        <span class="quantity-display">${quantity}</span>
        <button class="quantity-btn increase-btn" 
                onclick="increaseProductQuantity('${displayProduct.nombre}', event)"
                title="Aumentar cantidad">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;
  }
}

/**
 * Actualiza dinámicamente la sección de cantidad en la tarjeta del producto
 * @param {string} productName - Nombre del producto
 */
function updateProductQuantitySection(productName) {
  // Buscar todas las tarjetas de productos que coincidan
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    // Buscar si este card contiene este producto
    const titleEl = card.querySelector('.product-title');
    if (titleEl) {
      const cardProductName = titleEl.textContent.trim();
      const actualProductName = productName.replace(/\(v\d+\)\s*/g, "").trim();
      
      // Comparar nombres básicos (sin variantes)
      if (cardProductName.includes(actualProductName) || actualProductName.includes(cardProductName)) {
        const quantitySectionEl = card.querySelector('.quantity-section');
        if (quantitySectionEl) {
          // Obtener datos del producto para generar el HTML correcto
          const product = products.find(p => p.nombre === productName) ||
                         products.flatMap(p => p.isGrouped ? p.variants : []).find(v => v.nombre === productName);
          
          if (product) {
            const displayProduct = product.isGrouped ? product.variants[product.currentVariant] : product;
            quantitySectionEl.innerHTML = getProductQuantityHTML(productName, displayProduct);
          }
        }
      }
    }
  });
}

/**
 * Anima el número de cantidad (sube o baja según la acción)
 * @param {string} productName - Nombre del producto
 * @param {string} direction - 'increasing' o 'decreasing'
 */
function animateQuantityDisplay(productName, direction) {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    const titleEl = card.querySelector('.product-title');
    if (titleEl) {
      const cardProductName = titleEl.textContent.trim();
      const actualProductName = productName.replace(/\(v\d+\)\s*/g, "").trim();
      
      if (cardProductName.includes(actualProductName) || actualProductName.includes(cardProductName)) {
        const quantityDisplay = card.querySelector('.quantity-display');
        if (quantityDisplay) {
          // Remover animación anterior si existe
          quantityDisplay.classList.remove('increasing', 'decreasing');
          
          // Forzar reflow para que la animación se reinicie
          void quantityDisplay.offsetWidth;
          
          // Aplicar nueva animación
          quantityDisplay.classList.add(direction);
          
          // Remover clase después de que termine la animación
          setTimeout(() => {
            quantityDisplay.classList.remove(direction);
          }, 400);
        }
      }
    }
  });
}

/**
 * Incrementa la cantidad de un producto en el carrito
 * @param {string} productName - Nombre del producto
 * @param {event} event - Evento del click
 */
function increaseProductQuantity(productName, event) {
  if (event) event.stopPropagation();
  
  const decodedName = decodeURIComponent(productName);
  const cartItem = cart.find(item => {
    const itemData = item.product || item.pack;
    return itemData && itemData.nombre === decodedName;
  });
  
  if (cartItem) {
    cartItem.quantity += 1;
    updateCart();
    saveCart();
    
    // Animar el número después de actualizar
    setTimeout(() => {
      animateQuantityDisplay(decodedName, 'increasing');
    }, 50);
    
    updateProductQuantitySection(decodedName);
  }
}

/**
 * Disminuye la cantidad de un producto en el carrito
 * Si la cantidad llega a 0, lo elimina del carrito
 * @param {string} productName - Nombre del producto
 * @param {event} event - Evento del click
 */
function decreaseProductQuantity(productName, event) {
  if (event) event.stopPropagation();
  
  const decodedName = decodeURIComponent(productName);
  const cartIndex = cart.findIndex(item => {
    const itemData = item.product || item.pack;
    return itemData && itemData.nombre === decodedName;
  });
  
  if (cartIndex !== -1) {
    if (cart[cartIndex].quantity === 1) {
      // Eliminar del carrito si es el último
      cart.splice(cartIndex, 1);
    } else {
      cart[cartIndex].quantity -= 1;
      
      // Animar el número solo si no se elimina
      setTimeout(() => {
        animateQuantityDisplay(decodedName, 'decreasing');
      }, 50);
    }
    updateCart();
    saveCart();
    updateProductQuantitySection(decodedName);
  }
}

/**
 * Actualiza todas las secciones de cantidad en los productos visibles
 * Se llama después de cambios en el carrito
 */
function updateAllProductQuantitySections() {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    const quantitySectionEl = card.querySelector('.quantity-section');
    if (quantitySectionEl && quantitySectionEl.dataset.productName) {
      const productName = quantitySectionEl.dataset.productName;
      
      // Buscar el producto correspondiente
      const product = products.find(p => p.nombre === productName) ||
                     products.flatMap(p => p.isGrouped ? p.variants : []).find(v => v.nombre === productName);
      
      if (product) {
        const displayProduct = product.isGrouped ? product.variants[product.currentVariant] : product;
        quantitySectionEl.innerHTML = getProductQuantityHTML(productName, displayProduct);
      }
    }
  });
}

// Cerrar carrito al hacer clic fuera
document.addEventListener("click", (e) => {
  const cart = document.getElementById("cart");
  const cartBtn = document.querySelector(".cart-btn");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");

  // Manejar cierre del carrito
  if (
    cart &&
    cartBtn &&
    cart.classList.contains("active") &&
    !cart.contains(e.target) &&
    e.target !== cartBtn &&
    !cartBtn.contains(e.target)
  ) {
    closeCart();
  }

  // Manejar cierre del sidebar
  if (
    sidebar &&
    menuToggle &&
    sidebar.classList.contains("active") &&
    !sidebar.contains(e.target) &&
    e.target !== menuToggle &&
    !menuToggle.contains(e.target)
  ) {
    closeSidebar();
  }
});

/**
 * Abre WhatsApp with mensaje predeterminado
 */
function openWhatsApp() {
  const phoneNumber = "+5355884661";
  const message = encodeURIComponent(
    "Estoy interesado en los productos que vi en su tienda. ¿Podrían ayudarme?"
  );
  const url = `https://wa.me/${phoneNumber}?text=${message}`;

  // Abrir en una nueva pestaña
  window.open(url, "_blank");
}

// --- Funcionalidad para ocultar/mostrar header al hacer scroll (throttled con rAF) ---

let lastScrollY = 0;
const header = document.querySelector(".header");
const headerHeight = header ? header.offsetHeight : 60;
let ticking = false;

function handleScrollRaf() {
  const currentScrollY = window.scrollY;

  if (!header) {
    ticking = false;
    return;
  }

  if (currentScrollY <= headerHeight / 2) {
    header.classList.remove("header-hidden");
  } else if (currentScrollY > lastScrollY && currentScrollY > headerHeight) {
    header.classList.add("header-hidden");
  } else if (currentScrollY < lastScrollY) {
    header.classList.remove("header-hidden");
  }

  lastScrollY = currentScrollY;
  ticking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(handleScrollRaf);
    }
  },
  { passive: true }
);

// --- Fin de la funcionalidad del header ---

/* ========== CATEGORY CARD - PACKS ========== */

let packs = [];

/**
 * Cargar datos de packs desde JSON
 */
async function loadPacks() {
  try {
    const response = await fetch("Json/packs.json");
    if (!response.ok) throw new Error("Error al cargar packs");
    const data = await response.json();
    packs = data.packs || [];

    // Preprocesar packs para búsqueda (normalize sin tildes)
    packs.forEach((pack) => {
      pack._normalizedNombre = normalizeString(pack.nombre).toLowerCase();
      pack._normalizedDescripcion = normalizeString(pack.descripcion || pack.searchText || '').toLowerCase();
    });

    renderCategoryCard();
  } catch (error) {
    console.error("Error al cargar packs:", error);
  }
}

/**
 * Renderizar Category Card con los primeros 4 packs
 */
function renderCategoryCard() {
  const categoryCardItems = document.getElementById("category-card-items");
  
  if (!categoryCardItems) return;
  
  // Obtener solo los primeros 4 packs
  const displayPacks = packs.slice(0, 4);
  
  // Si no hay packs, ocultar la sección
  if (displayPacks.length === 0) {
    document.querySelector(".category-card-section").style.display = "none";
    return;
  }
  
  // Limpiar el contenedor
  categoryCardItems.innerHTML = "";
  
  // Crear items para cada pack
  displayPacks.forEach((pack) => {
    const item = document.createElement("div");
    item.className = "category-card-item";
    item.style.cursor = "pointer";
    item.onclick = () => showPackDetail(encodeURIComponent(pack.nombre));
    
    // Construir ruta de imagen
    const imagePath = `Images/Packs/${pack.imagen}`;
    
    item.innerHTML = `
      <div class="category-card-image-container">
        <img src="${imagePath}" 
             alt="${pack.nombre}" 
             class="category-card-image"
             loading="lazy" 
             decoding="async"
             onerror="this.src='Images/pack-placeholder.svg'">
      </div>
      <div class="category-card-label">${pack.nombre}</div>
    `;
    
    categoryCardItems.appendChild(item);
  });
}

/**
 * Función para mostrar todos los packs en un panel tipo detail
 */
function showAllPacks() {
  window.scrollTo({ top: 0 });
  
  // Actualizar historial con hash "packs"
  const currentHashDecoded = decodeURIComponent(window.location.hash.substring(1) || '');
  if (currentHashDecoded !== 'packs') {
    window.location.hash = encodeURIComponent('packs');
  }
  
  // Ocultar elementos principales
  const categoryCardSection = document.getElementById("category-card-section");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const productsContainer = document.getElementById("products-container");
  
  if (categoryCardSection) categoryCardSection.style.display = "none";
  if (categoriesCircleSection) categoriesCircleSection.style.display = "none";
  if (bannerContainer) bannerContainer.style.display = "none";
  if (bestSellersSection) bestSellersSection.style.display = "none";
  if (productsContainer) productsContainer.style.display = "none";
  
  // Mostrar panel de packs
  renderPacksDetail();
}

/**
 * Renderizar el panel de detalle de packs (estilo Amazon)
 */
function renderPacksDetail() {
  const packsDetailContainer = document.getElementById("packs-detail");
  
  if (!packsDetailContainer) return;
  
  // Ocultar elementos principales para mostrar el panel de packs
  const categoryCardSection = document.getElementById("category-card-section");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const productsContainer = document.getElementById("products-container");
  const detailContainer = document.getElementById("product-detail");

  if (categoryCardSection) categoryCardSection.style.display = "none";
  if (categoriesCircleSection) categoriesCircleSection.style.display = "none";
  if (bannerContainer) bannerContainer.style.display = "none";
  if (bestSellersSection) bestSellersSection.style.display = "none";
  if (productsContainer) productsContainer.style.display = "none";
  if (detailContainer) {
    detailContainer.style.display = "none";
    detailContainer.innerHTML = "";
  }
  
  // Construir HTML del panel
  let packsHTML = `
    <button class="back-button-packs" onclick="window.history.back()">
      <i class="fas fa-chevron-left"></i> Volver
    </button>
    
    <div class="packs-detail-header">
      <h1 class="packs-detail-title">Todos los Packs Disponibles</h1>
      <button class="packs-detail-close" onclick="window.history.back()">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <div class="packs-grid" id="packs-grid">
  `;
  
  // Iterar sobre todos los packs y crear tarjetas
  packs.forEach(pack => {
    let badges = '';
    if (pack.top) badges += `<span class="pack-badge top"><i class="fas fa-star"></i> Nº1 Vendido</span>`;
    if (pack.oferta) badges += `<span class="pack-badge oferta"><i class="fas fa-tag"></i> Oferta</span>`;
    if (pack.nuevo) badges += `<span class="pack-badge nuevo"><i class="fas fa-star-half"></i> Nuevo</span>`;
    
    const caracteristicas = pack.caracteristicas.map(item => `<li class="pack-content-item">${item}</li>`).join('');
    const imagePath = `Images/Packs/${pack.imagen}`;
    const finalPrice = pack.descuento > 0 
      ? (pack.precio * (1 - pack.descuento / 100)).toFixed(2)
      : pack.precio.toFixed(2);
    const discountText = pack.descuento > 0 
      ? `<div class="pack-discount">Ahorras un ${pack.descuento}%</div>`
      : '';
    
    packsHTML += `
      <article class="pack-card" style="cursor: pointer;" onclick="showPackDetail('${encodeURIComponent(pack.nombre)}', event)">
        <div class="pack-badge-row">${badges}</div>
        
        <div class="pack-img-container">
          <img src="${imagePath}" 
               alt="${pack.nombre}" 
               class="pack-img"
               loading="lazy" 
               decoding="async"
               onerror="this.src='Images/pack-placeholder.svg'">
        </div>
        
        <h2 class="pack-name">${pack.nombre}</h2>
        <p class="pack-desc">${pack.descripcion}</p>
        
        <div class="pack-content-box">
          <span class="pack-content-title">Contenido del Pack:</span>
          <ul class="pack-content-list">${caracteristicas}</ul>
        </div>
        
        <div class="pack-price-section">
          <div class="pack-price">
            <span class="pack-price-symbol">$</span>${finalPrice}
          </div>
          ${discountText}
        </div>
        
        <button class="pack-btn" 
                onclick="addPackToCart('${pack.nombre}', event)"
                ${!pack.disponible ? 'disabled' : ''}>
          ${pack.disponible ? 'Agregar al carrito' : 'No disponible'}
        </button>
      </article>
    `;
  });
  
  packsHTML += `
    </div>
  `;
  
  packsDetailContainer.innerHTML = packsHTML;
  packsDetailContainer.classList.add('active');
  packsDetailContainer.style.display = "block";
}

/**
 * Mostrar detalle del pack
 */
function showPackDetail(packName, event) {
  if (event) event.stopPropagation();
  
  window.scrollTo({ top: 0 });
  const decodedName = decodeURIComponent(packName);
  const pack = packs.find((p) => p.nombre === decodedName);
  
  // Actualizar historial con hash
  const currentHashDecoded = decodeURIComponent(window.location.hash.substring(1) || '');
  if (currentHashDecoded !== decodedName) {
    window.location.hash = encodeURIComponent(decodedName);
  }
  
  if (!pack) {
    console.error("Pack no encontrado:", decodedName);
    return;
  }
  
  // Ocultar elementos principales
  const categoryCardSection = document.getElementById("category-card-section");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const productsContainer = document.getElementById("products-container");
  const packsDetailContainer = document.getElementById("packs-detail");
  
  if (categoryCardSection) categoryCardSection.style.display = "none";
  if (categoriesCircleSection) categoriesCircleSection.style.display = "none";
  if (bannerContainer) bannerContainer.style.display = "none";
  if (bestSellersSection) bestSellersSection.style.display = "none";
  if (productsContainer) productsContainer.style.display = "none";
  if (packsDetailContainer) packsDetailContainer.style.display = "none";
  
  // Determinar precio final
  const isOnSale = pack.oferta && pack.descuento > 0;
  const finalPrice = isOnSale
    ? (pack.precio * (1 - pack.descuento / 100)).toFixed(2)
    : pack.precio.toFixed(2);
  const priceSave = isOnSale ? (pack.precio - finalPrice).toFixed(2) : 0;
  
  // Construir badges
  const badges = [];
  if (pack.nuevo) badges.push('<span class="detail-badge nuevo"><i class="fas fa-star"></i> Nuevo</span>');
  if (pack.oferta) badges.push(`<span class="detail-badge oferta"><i class="fas fa-tag"></i> ${Math.round(pack.descuento)}% OFF</span>`);
  if (pack.top) badges.push('<span class="detail-badge mas-vendido"><i class="fas fa-trophy"></i> Nº1 Vendido</span>');
  if (!pack.disponible) badges.push('<span class="detail-badge agotado"><i class="fas fa-ban"></i> AGOTADO</span>');
  
  // Construir características como especificaciones
  const caracteristicasHTML = pack.caracteristicas.map(item => 
    `<li><strong>Incluye:</strong> ${item}</li>`
  ).join('');
  
  // Mostrar detalle del pack en el contenedor de product-detail
  const detailContainer = document.getElementById("product-detail");
  if (!detailContainer) return;
  
  const imagePath = `Images/Packs/${pack.imagen}`;
  
  detailContainer.innerHTML = `
    <div class="detail-container">
      <div class="detail-gallery">
        <div class="main-image-container">
          <img src="${imagePath}" 
               class="main-image" 
               alt="${pack.nombre}" 
               loading="lazy" 
               decoding="async"
               onerror="this.src='Images/pack-placeholder.svg'">
        </div>
      </div>
      
      <div class="detail-info">
        <h1 class="detail-title">${pack.nombre}</h1>
        ${badges.length ? `<div class="detail-badges">${badges.join('')}</div>` : ''}
        
        <div class="price-section">
          ${isOnSale ? `
            <div class="price-with-discount">
              PVPR:
              <span class="price-original">${pack.precio.toFixed(2)}</span>
            </div>
            <span class="price-current">Precio: ${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-lg"></span>
            <div class="price-save">Ahorras ${priceSave}</div>
          ` : `
            <span class="price-current">Precio: ${finalPrice} <img src="Images/Zelle.svg" alt="Zelle" class="currency-icon price-lg"></span>
          `}
        </div>
        
        <!-- AVISO DE COSTO DE DOMICILIO -->
        <div class="delivery-info">
          <span style="display:block; padding:12px 16px; background:#ffffff; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); font-size:1em; color:#2c2c2c; line-height:1.55;">
            <span class="envio-badge">✓ Envío</span>
            <i class="fas fa-truck-fast"></i>
            <br>
            Envío gratuito dentro del municipio. Entrega en 24–48 horas. Para envíos
            fuera del municipio, el costo del domicilio se coordina al confirmar el
            pedido.
          </span>
        </div>
        <!-- FIN AVISO DOMICILIO -->
        
        <div class="quantity-section">
          <label class="quantity-label">Cantidad:</label>
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="adjustDetailQuantity(-1, event)">
              <i class="fas fa-minus"></i>
            </button>
            <span class="quantity-display" id="detail-quantity">1</span>
            <button class="quantity-btn" onclick="adjustDetailQuantity(1, event)">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
        
        <button class="add-to-cart-btn ${!pack.disponible ? 'disabled' : ''}" 
                onclick="addPackToCartFromDetail('${pack.nombre}', event)"
                ${!pack.disponible ? 'disabled' : ''}>
          <i class="fas fa-${!pack.disponible ? 'lock' : 'cart-plus'}"></i>
          ${!pack.disponible ? 'Pack Agotado' : 'Agregar al carrito'}
        </button>
        
        <div class="product-description">
          <h4 class="description-title"><i class="fas fa-align-left"></i> Descripción</h4>
          <div class="description-content">
            <p>${pack.descripcion}</p>
          </div>
        </div>
        
        <div class="product-specs">
          <h3 class="specs-title"><i class="fas fa-list-ul"></i> Contenido del Pack</h3>
          <ul class="specs-list">
            ${caracteristicasHTML}
          </ul>
        </div>
      </div>
      
      <div class="back-btn-container">
        <button class="back-btn" onclick="window.history.back()">
          <i class="fas fa-arrow-left"></i> Volver
        </button>
      </div>
    </div>
  `;
  
  detailContainer.style.display = "block";
}

/**
 * Ocultar detalle del pack y volver
 */
function hidePackDetail() {
  const detailContainer = document.getElementById("product-detail");
  const categoryCardSection = document.getElementById("category-card-section");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const productsContainer = document.getElementById("products-container");
  
  if (detailContainer) {
    detailContainer.style.display = "none";
    detailContainer.innerHTML = "";
  }
  
  // Limpiar hash del historial
  window.location.hash = "";
  
  // Mostrar elementos principales
  if (categoryCardSection) categoryCardSection.style.display = "block";
  if (categoriesCircleSection) categoriesCircleSection.style.display = "block";
  if (bannerContainer) bannerContainer.style.display = "block";
  if (bestSellersSection) bestSellersSection.style.display = "block";
  if (productsContainer) productsContainer.style.display = "grid";
}

/**
 * Agregar pack al carrito desde el detail view
 */
function addPackToCartFromDetail(packName, event) {
  if (event) event.stopPropagation();

  const decodedName = decodeURIComponent(packName);
  const pack = packs.find((p) => p.nombre === decodedName);

  if (!pack) return;

  // Validar disponibilidad
  if (!pack.disponible) {
    showCartNotification("Este pack está agotado", 1, "error");
    return;
  }

  // Obtener cantidad del input de cantidad
  const quantityElement = document.getElementById("detail-quantity");
  const quantity = quantityElement ? parseInt(quantityElement.textContent) || 1 : 1;

  // Buscar si el pack ya está en el carrito
  const existingItem = cart.find((item) => item.pack && item.pack.nombre === decodedName);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    // Agregar pack con estructura similar a productos
    cart.push({ 
      pack: pack, 
      quantity: quantity,
      isPack: true
    });
  }

  updateCart();
  saveCart();
  showCartNotification(pack.nombre, quantity);
}

/**
 * Ocultar panel de packs y volver a la página principal
 */
function hidePacksDetail() {
  const packsDetailContainer = document.getElementById("packs-detail");
  const detailContainer = document.getElementById("product-detail");
  const categoryCardSection = document.getElementById("category-card-section");
  const categoriesCircleSection = document.querySelector(".categories-circle-section");
  const bannerContainer = document.querySelector(".carousel-container");
  const bestSellersSection = document.querySelector(".best-sellers-section");
  const productsContainer = document.getElementById("products-container");
  
  if (packsDetailContainer) {
    packsDetailContainer.style.display = "none";
    packsDetailContainer.classList.remove('active');
    packsDetailContainer.innerHTML = "";
  }
  
  if (detailContainer) {
    detailContainer.style.display = "none";
    detailContainer.innerHTML = "";
  }
  
  // Limpiar hash del historial (si venía de #packs)
  const currentHashDecoded = decodeURIComponent(window.location.hash.substring(1) || '');
  if (currentHashDecoded === 'packs') {
    // Si el hash es 'packs' dejarlo vacío para volver al contenido principal
    window.location.hash = "";
  }
  
  // Mostrar elementos principales
  if (categoryCardSection) categoryCardSection.style.display = "block";
  if (categoriesCircleSection) categoriesCircleSection.style.display = "block";
  if (bannerContainer) bannerContainer.style.display = "block";
  if (bestSellersSection) bestSellersSection.style.display = "block";
  if (productsContainer) productsContainer.style.display = "grid";
}

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  // Cargar productos y packs en paralelo y esperar ambos para que el manejo de rutas tenga ambos datasets disponibles
  await Promise.all([loadProducts(), loadPacks()]);
  initCarousel();

  // Si hay un hash en la URL al cargar la página, procesarlo ahora que tenemos products y packs
  if (window.location.hash) {
    handleRouteChange();
  }

  // Debounce para búsqueda en tiempo real
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.setAttribute('aria-haspopup', 'listbox');
    searchInput.setAttribute('aria-expanded', 'false');

    searchInput.addEventListener(
      "input",
      debounce(() => {
        searchProducts();
        const normalized = normalizeString(searchInput.value || '').toLowerCase().trim();
        renderSearchSuggestions(getSearchSuggestions(normalized, 6));
      }, SEARCH_DEBOUNCE_MS)
    );

    // Navegación por teclado dentro del dropdown de sugerencias (usa dataset en el container)
    searchInput.addEventListener('keydown', (e) => {
      const container = document.getElementById('search-suggestions');
      if (!container) return;
      const items = Array.from(container.querySelectorAll('.search-suggestion-item'));
      if (!items.length) return;

      let suggestionIndex = parseInt(container.dataset.suggestionIndex || '-1', 10);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
        items.forEach(it => it.classList.remove('active'));
        items[suggestionIndex].classList.add('active');
        items[suggestionIndex].scrollIntoView({ block: 'nearest' });
        container.dataset.suggestionIndex = String(suggestionIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestionIndex = Math.max(suggestionIndex - 1, 0);
        items.forEach(it => it.classList.remove('active'));
        items[suggestionIndex].classList.add('active');
        items[suggestionIndex].scrollIntoView({ block: 'nearest' });
        container.dataset.suggestionIndex = String(suggestionIndex);
      } else if (e.key === 'Enter') {
        const active = container.querySelector('.search-suggestion-item.active');
        if (active) {
          e.preventDefault();
          active.dispatchEvent(new MouseEvent('mousedown'));
        } else {
          searchProducts();
        }
      } else if (e.key === 'Escape') {
        clearSearchSuggestions();
      }
    });

    // ocultar sugerencias al perder foco (con pequeño delay para permitir click)
    searchInput.addEventListener('blur', () => setTimeout(() => clearSearchSuggestions(), 120));

    // Mostrar sugerencias al enfocar (cuando el input está vacío) — muestra mas vendidos y categorías
    searchInput.addEventListener('focus', () => {
      const val = (searchInput.value || '').trim();
      if (!val) {
        const popular = (products || []).filter(p => p.mas_vendido).slice(0,4).map(p => ({ type: 'product', data: p }));
        const cats = (categories || []).slice(0,2).map(c => ({ type: 'category', data: c }));
        const defaults = popular.concat(cats).slice(0, 6);
        if (defaults.length) {
          renderSearchSuggestions(defaults);
          positionSearchSuggestions();
        }
      }
    });

    // Reposicionar al hacer resize/scroll para mantener el dropdown pegado al input
    window.addEventListener('resize', () => positionSearchSuggestions());
    window.addEventListener('scroll', () => positionSearchSuggestions(), { passive: true });

    // Click fuera -> cerrar
    document.addEventListener('click', (ev) => {
      const container = document.getElementById('search-suggestions');
      if (!container || container.style.display === 'none') return;
      const input = document.getElementById('search-input');
      if (ev.target === input || input.contains(ev.target) || container.contains(ev.target)) return;
      clearSearchSuggestions();
    });
  }
});
