/**
 * BUQUENQUE - SISTEMA DINÁMICO DE FRESCURA VISUAL
 * Similar a Amazon: orden inteligente, badges temporales, micro-animaciones
 * Modular, no invasivo, sin pop-ups ni notificaciones.
 */

// ========== CONFIGURACIÓN ==========
const DYNAMIC_CONFIG = {
  // Orden dinámico inteligente
  newProductBoostHours: 48,          // Horas de boost máximo para productos nuevos
  newProductFadeoutHours: 72,        // Horas para que desaparezca el boost
  recentProductsCount: 5,             // Cantidad de productos "Recién añadidos"
  
  // Rotación aleatoria
  normalOrderPercent: 70,             // 70% orden normal
  randomShufflePercent: 30,           // 30% shuffle aleatorio
  
  // Badges temporales
  badgeNewToday: 1,                   // 1 día para badge "Nuevo hoy"
  badgeNewThisWeek: 7,                // 7 días para badge "Nuevo esta semana"
  badgeUpdated: 14,                   // 14 días para badge "Actualizado"
  
  // Layout dinámico
  layoutVariations: true,             // Activar variaciones de layout según el día
  massonryEnabled: false,             // Desactivado por ahora (muy invasivo)
};

// ========== UTILIDADES DE FECHAS ==========

/**
 * Obtiene la hora actual en milisegundos (consistente para toda la sesión)
 */
function getCurrentTimestamp() {
  return Date.now();
}

/**
 * Calcula los días entre dos fechas
 */
function daysBetween(date1, date2) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2 - date1) / msPerDay);
}

/**
 * Obtiene la fecha de creación de un producto
 * Si no existe created_at, genera una basada en el ID del producto (consistente)
 */
function getProductCreatedDate(product) {
  if (product.created_at) {
    return new Date(product.created_at);
  }
  
  // Generar una fecha consistente basada en el ID
  if (product.id) {
    // Extraer timestamp del ID si existe (formato: prod_157XXXXX_XXXXX)
    const match = product.id.match(/prod_(\d+)_/);
    if (match && match[1]) {
      return new Date(parseInt(match[1]));
    }
  }
  
  // Fallback: fecha aleatoria pero consistente para este producto
  const seed = product.nombre.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const dayOffset = Math.abs(seed) % 30;
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  return date;
}

/**
 * Calcula el "score" de un producto para ordenamiento dinámico
 * Mayor score = más relevante = aparece primero
 */
function calculateProductScore(product, currentTime = getCurrentTimestamp()) {
  let score = 0;
  
  // Base score según disponibilidad
  if (!product.disponibilidad) return -1000;
  
  // Score por ser más vendido
  if (product.mas_vendido) score += 50;
  
  // Score por tener oferta
  if (product.oferta && product.descuento > 0) score += 20;
  
  // Score temporal: boost para productos nuevos
  const createdDate = getProductCreatedDate(product);
  const hoursOld = (currentTime - createdDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursOld <= DYNAMIC_CONFIG.newProductBoostHours) {
    // Boost máximo en las primeras 24 horas, luego decay
    const boostFactor = Math.max(0, 1 - (hoursOld / DYNAMIC_CONFIG.newProductFadeoutHours));
    score += 100 * boostFactor;
  }
  
  // Pequeño boost aleatorio consistente (basado en ID)
  const seed = product.id.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const randomBoost = (Math.abs(seed) % 5) - 2.5; // -2.5 a +2.5
  score += randomBoost;
  
  return score;
}

/**
 * Ordena productos de forma inteligente
 * Aplica boost temporal y rotación controlada
 */
function sortProductsDynamic(productsToSort, currentTime = getCurrentTimestamp()) {
  if (!productsToSort || productsToSort.length === 0) return [];
  
  // Crear copia para no mutar original
  const sorted = [...productsToSort];
  
  // Calcular scores
  const scores = sorted.map(p => ({
    product: p,
    score: calculateProductScore(p, currentTime)
  }));
  
  // Ordenar por score descendente
  scores.sort((a, b) => b.score - a.score);
  
  // Aplicar rotación aleatoria controlada (70% orden normal, 30% shuffle)
  const randomPercent = Math.random() * 100;
  
  if (randomPercent < DYNAMIC_CONFIG.randomShufflePercent) {
    // Shuffle solo en los primeros 15 productos para no romper mucho el orden
    const shuffleCount = Math.min(15, Math.floor(scores.length * 0.15));
    const toShuffle = scores.splice(0, shuffleCount);
    
    // Fisher-Yates shuffle
    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }
    
    scores.unshift(...toShuffle);
  }
  
  return scores.map(s => s.product);
}

/**
 * Ordena best sellers con rotación más conservadora
 * (menos invasivo que categorías)
 */
function sortBestSellersDynamic(productsToSort, currentTime = getCurrentTimestamp()) {
  if (!productsToSort || productsToSort.length === 0) return [];
  
  const sorted = [...productsToSort];
  
  // Para best sellers solo usamos:
  // - Score base (no boost temporal, ya son "top")
  // - Random muy ligero (15% solo)
  const scores = sorted.map(p => ({
    product: p,
    score: calculateProductScore(p, currentTime) - 50  // Reducir boost temporal para top
  }));
  
  scores.sort((a, b) => b.score - a.score);
  
  // Aplicar rotación muy ligera: solo 15% de probabilidad
  const randomPercent = Math.random() * 100;
  
  if (randomPercent < 15) {
    // Muy poco shuffle (solo 5 primeros)
    const shuffleCount = Math.min(5, Math.floor(scores.length * 0.08));
    const toShuffle = scores.splice(0, shuffleCount);
    
    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }
    
    scores.unshift(...toShuffle);
  }
  
  return scores.map(s => s.product);
}

// ========== BADGES TEMPORALES ==========

/**
 * Determina qué badges debe tener un producto
 */
function getProductBadges(product, currentTime = getCurrentTimestamp()) {
  const badges = [];
  const createdDate = getProductCreatedDate(product);
  const daysOld = daysBetween(createdDate, new Date(currentTime));
  
  // Badge: "Nuevo hoy"
  if (daysOld <= DYNAMIC_CONFIG.badgeNewToday) {
    badges.push({
      type: 'new-today',
      label: 'Nuevo hoy',
      icon: 'fa-star',
      class: 'badge-new-today',
      expiresIn: DYNAMIC_CONFIG.badgeNewToday - daysOld
    });
  }
  // Badge: "Nuevo esta semana"
  else if (daysOld <= DYNAMIC_CONFIG.badgeNewThisWeek) {
    badges.push({
      type: 'new-week',
      label: 'Nuevo esta semana',
      icon: 'fa-sparkles',
      class: 'badge-new-week',
      expiresIn: DYNAMIC_CONFIG.badgeNewThisWeek - daysOld
    });
  }
  
  // Badge: "Actualizado"
  const modifiedDate = product.modified_at ? new Date(product.modified_at) : null;
  if (modifiedDate) {
    const daysModified = daysBetween(modifiedDate, new Date(currentTime));
    if (daysModified <= DYNAMIC_CONFIG.badgeUpdated) {
      badges.push({
        type: 'updated',
        label: 'Actualizado',
        icon: 'fa-sync-alt',
        class: 'badge-updated',
        expiresIn: DYNAMIC_CONFIG.badgeUpdated - daysModified
      });
    }
  }
  
  return badges;
}

/**
 * Filtra productos "Recién añadidos"
 * Retorna los productos más nuevos (últimos N days)
 */
function getRecentProducts(productsArray, count = DYNAMIC_CONFIG.recentProductsCount, currentTime = getCurrentTimestamp()) {
  if (!productsArray || productsArray.length === 0) return [];
  
  // Filtrar solo disponibles
  const available = productsArray.filter(p => p.disponibilidad !== false);
  
  // Filtrar productos de los últimos 14 días
  const recent = available.filter(p => {
    const createdDate = getProductCreatedDate(p);
    const daysOld = daysBetween(createdDate, new Date(currentTime));
    return daysOld <= 14; // Últimas 2 semanas
  });
  
  // Ordenar por más nuevos primero
  recent.sort((a, b) => {
    const dateA = getProductCreatedDate(a).getTime();
    const dateB = getProductCreatedDate(b).getTime();
    return dateB - dateA;
  });
  
  // Retornar solo los N más recientes
  return recent.slice(0, count);
}

// ========== LAYOUT DINÁMICO SEGÚN DÍA ==========

/**
 * Obtiene variación de layout basada en el día de la semana
 * Devuelve: 'normal', 'compact', 'spread' (para futuras variaciones)
 */
function getDayLayoutVariation() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = domingo, 6 = sábado
  
  // Variaciones sutiles:
  // Lunes-Miércoles: normal (70%)
  // Jueves-Viernes: compact (gap más pequeño)
  // Sábado-Domingo: spread (gap más grande)
  
  if (dayOfWeek >= 4) { // Jueves y Viernes
    return 'compact';
  } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Fin de semana
    return 'spread';
  }
  
  return 'normal';
}

/**
 * Aplica clase CSS al grid según la variación del día
 */
function applyDayLayoutVariation() {
  if (!DYNAMIC_CONFIG.layoutVariations) return;
  
  const container = document.getElementById('products-container');
  if (!container) return;
  
  const variation = getDayLayoutVariation();
  
  // Remover clases previas
  container.classList.remove('layout-normal', 'layout-compact', 'layout-spread');
  
  // Aplicar nueva clase
  container.classList.add(`layout-${variation}`);
}

// ========== ANIMACIONES DINÁMICAS ==========

/**
 * Añade clase de animación a un elemento cuando se renderiza
 */
function animateElement(element, animationType = 'fade-in') {
  if (!element) return;
  
  element.classList.add(`animate-${animationType}`);
  
  // Remover clase después de la animación
  setTimeout(() => {
    element.classList.remove(`animate-${animationType}`);
  }, 600);
}

/**
 * Aplica micro-animación de borde a productos nuevos
 */
function applyNewProductBorderAnimation(productElement) {
  if (!productElement) return;
  
  productElement.classList.add('new-product-pulse');
  
  // Remover después de 2 segundos
  setTimeout(() => {
    productElement.classList.remove('new-product-pulse');
  }, 2000);
}

// ========== INTEGRACIÓN CON RENDERIZADO EXISTENTE ==========

/**
 * Hook: Enriquece cada producto con datos dinámicos ANTES de renderizar
 * Llamar después de loadProducts(), antes de renderProducts()
 */
function enrichProductsWithDynamicData(productsArray, currentTime = getCurrentTimestamp()) {
  if (!productsArray) return;
  
  productsArray.forEach(product => {
    // Agregar datos dinámicos
    product._dynamicScore = calculateProductScore(product, currentTime);
    product._dynamicBadges = getProductBadges(product, currentTime);
    product._createdDate = getProductCreatedDate(product);
    product._daysOld = daysBetween(product._createdDate, new Date(currentTime));
  });
}

/**
 * Sobrescribe el ordenamiento de renderProducts()
 * Llamar en la sección de producto groupedByCategory
 */
function applySortingToCategoryProducts(categoryProducts) {
  // Aplicar ordenamiento dinámico a los productos de cada categoría
  return sortProductsDynamic(categoryProducts);
}

// ========== SECCIÓN "RECIÉN AÑADIDOS" ==========

/**
 * Genera HTML para la sección "Recién añadidos"
 * Se inserta DESPUÉS del banner, ANTES del grid principal
 */
function renderRecentProductsSection(productsArray) {
  const recentProducts = getRecentProducts(productsArray);
  
  if (recentProducts.length === 0) {
    return ''; // No renderizar si no hay productos recientes
  }
  
  const container = document.getElementById('products-container');
  if (!container) return '';
  
  // Crear elemento de sección
  const section = document.createElement('div');
  section.className = 'recent-products-section';
  section.setAttribute('data-section', 'recent-products');
  
  // Header
  const header = document.createElement('div');
  header.className = 'recent-products-header';
  header.innerHTML = `
    <div class="recent-products-title-wrapper">
      <h3 class="recent-products-title">
        <i class="fas fa-clock"></i> Recién añadidos
      </h3>
      <p class="recent-products-subtitle">Descubre nuestros últimos productos</p>
    </div>
  `;
  section.appendChild(header);
  
  // Grid de productos
  const grid = document.createElement('div');
  grid.className = 'recent-products-grid';
  
  recentProducts.forEach((product, index) => {
    const displayProduct = product.isGrouped
      ? product.variants[product.currentVariant]
      : product;
    
    const card = document.createElement('div');
    card.className = 'recent-product-card';
    card.style.animationDelay = `${index * 0.1}s`;
    
    const isOnSale = displayProduct.oferta && displayProduct.descuento > 0;
    const finalPrice = isOnSale
      ? (displayProduct.precio * (1 - displayProduct.descuento / 100)).toFixed(2)
      : displayProduct.precio.toFixed(2);
    
    card.innerHTML = `
      <div class="recent-product-image" 
           onclick="showProductDetail('${encodeURIComponent(displayProduct.nombre)}')">
        <img src="Images/products/${displayProduct.imagenes[0]}" 
             alt="${displayProduct.nombre}"
             loading="lazy"
             decoding="async">
        ${isOnSale ? `<span class="recent-product-badge-sale">-${Math.round(displayProduct.descuento)}%</span>` : ''}
      </div>
      <div class="recent-product-info">
        <h4 class="recent-product-title">${displayProduct.nombre}</h4>
        <p class="recent-product-price">${finalPrice} <img src="Images/Zelle.svg" alt="$" class="currency-icon price-xs"></p>
      </div>
    `;
    
    animateElement(card, 'fade-in');
    grid.appendChild(card);
  });
  
  section.appendChild(grid);
  
  // Insertar la sección en el contenedor
  // Se inserta como primer elemento si existe un category-panel, sino al inicio
  const firstCategoryPanel = container.querySelector('.category-panel');
  if (firstCategoryPanel) {
    container.insertBefore(section, firstCategoryPanel);
  } else {
    container.insertBefore(section, container.firstChild);
  }
  
  return section;
}

// ========== HELPERS PARA INTEGRACIÓN ==========

/**
 * Inicializa el sistema dinámico
 * Llamar después de loadProducts()
 */
function initDynamicSystem() {
  // Verificar que los datos estén cargados
  if (typeof products === 'undefined' || !Array.isArray(products)) {
    console.warn('[DynamicSystem] products no está disponible');
    return;
  }
  
  // Enriquecer productos con datos dinámicos
  enrichProductsWithDynamicData(products);
  
  // Aplicar variación de layout según el día
  applyDayLayoutVariation();
}

/**
 * Actualiza datos dinámicos (llamar cada vez que se renderizan productos)
 */
function updateDynamicSystem() {
  if (typeof products === 'undefined') return;
  
  const currentTime = getCurrentTimestamp();
  
  // Re-enriquecer (los scores pueden cambiar con el tiempo)
  enrichProductsWithDynamicData(products, currentTime);
  
  // Aplicar layout
  applyDayLayoutVariation();
}

/**
 * Exportar para debuggear/testear
 */
window.BUQUENQUE_DYNAMIC = {
  config: DYNAMIC_CONFIG,
  calculateProductScore,
  sortProductsDynamic,
  sortBestSellersDynamic,
  getProductBadges,
  getRecentProducts,
  enrichProductsWithDynamicData,
  renderRecentProductsSection,
  getDayLayoutVariation,
  applyDayLayoutVariation,
  initDynamicSystem,
  updateDynamicSystem,
};

console.log('[Buquenque Dynamic System] ✓ Cargado exitosamente');
