// rating.js - Módulo de frontend para ratings (ES Modules)

// Lock map para evitar peticiones concurrentes por producto
const locks = new Map();

// Configurable API base para los endpoints del backend.
// Si la app se sirve con Live Server en el puerto 5500, intentamos usar el backend por defecto en :10000
let API_BASE = '';
(function detectApiBase() {
  try {
    const port = window.location.port;
    if (port === '5500' || port === '5501') {
      API_BASE = 'http://localhost:10000';
      console.info('[rating] Auto API base set to', API_BASE);
    }
  } catch (e) {
    // noop
  }
})();

/**
 * Establece explícitamente la base URL de la API (sin slash final)
 * Ejemplo: setApiBase('http://localhost:10000')
 */
export function setApiBase(base) {
  if (!base) {
    API_BASE = '';
    return;
  }
  API_BASE = base.replace(/\/$/, '');
  console.info('[rating] API base set to', API_BASE);
}

/**
 * Obtiene o genera un userHash persistente en localStorage.
 * Genera un UUID y lo hashea con SHA-256 usando crypto.subtle.
 */
export async function getUserHash() {
  let hash = localStorage.getItem("user_hash");
  if (hash) return hash;

  const uuid = crypto.randomUUID();
  const enc = new TextEncoder().encode(uuid);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const hashArray = Array.from(new Uint8Array(digest));
  hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem("user_hash", hash);
  return hash;
}

/**
 * Llama al endpoint GET /product-ratings?productId=...
 * Devuelve el objeto JSON del backend (con avgRating y totalVotes)
 */
export async function fetchProductRatings(productId) {
  const base = API_BASE || '';
  const url = `${base}/product-ratings?productId=${encodeURIComponent(productId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(`Método no permitido (405). Asegúrate de usar la URL del backend. Puedes llamar setApiBase('http://localhost:10000') si tu backend corre en el puerto 10000.`);
    }
    throw new Error(`Error al obtener ratings (status: ${res.status})`);
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Error al obtener ratings");
  return data;
}

/**
 * Envia un rating al backend POST /rate-product y actualiza la UI
 * Implementa bloqueo por producto para evitar doble envío.
 */
export async function sendRating(productId, rating) {
  if (locks.get(productId)) {
    // Petición en curso para este producto
    return Promise.reject(new Error("Petición en curso"));
  }

  locks.set(productId, true);
  const starsContainer = document.querySelector(`#product-${productId} .stars`);
  // Feedback mínimo: deshabilitar clicks y atenuar visualmente
  if (starsContainer) {
    starsContainer.dataset.loading = "true";
    starsContainer.style.pointerEvents = "none";
    starsContainer.style.opacity = "0.6";
  }

  try {
    const userHash = await getUserHash();
    const base = API_BASE || '';
    const url = `${base}/rate-product`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, rating, userHash })
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 405) {
        throw new Error(`Método no permitido (405) al POST a ${url}. Probablemente estás enviando la petición al servidor estático (p.ej. Live Server). Establece el backend con setApiBase('http://localhost:10000') o sirve el frontend desde el backend.`);
      }
      throw new Error(`Error en servidor: ${res.status} - ${text}`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Error al enviar rating');

    updateProductUI(productId, Number(data.avgRating) || 0, Number(data.totalVotes) || 0);
    return data;
  } catch (err) {
    console.error('Error enviando rating:', err);
    alert('No se pudo enviar tu voto. Intenta de nuevo.');
    throw err;
  } finally {
    locks.delete(productId);
    if (starsContainer) {
      delete starsContainer.dataset.loading;
      starsContainer.style.pointerEvents = '';
      starsContainer.style.opacity = '';
    }
  }
}

/**
 * Actualiza la UI del producto: avgRating, totalVotes y re-renderiza estrellas
 */
// Encuentra nodos relevantes para un productId (cards y detalle)
function findProductNodes(productId) {
  const nodes = [];
  const byId = document.querySelector(`#product-${productId}`);
  if (byId) nodes.push(byId);
  const byData = document.querySelector(`[data-product-id="${productId}"]`);
  if (byData) nodes.push(byData);
  return nodes;
}

// Caché local en memoria para ratings (reduce fetchs repetidos)
const ratingCache = new Map(); // productId -> { avg, votes, ts }
const RATING_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Queue y control de concurrencia para fetchs de ratings
const fetchQueue = [];
let activeFetches = 0;
const MAX_CONCURRENCY = 6;

function processQueueNext() {
  if (!fetchQueue.length || activeFetches >= MAX_CONCURRENCY) return;
  const { productId, resolve, reject } = fetchQueue.shift();
  activeFetches++;
  fetchProductRatings(productId)
    .then((data) => {
      ratingCache.set(productId, { avg: Number(data.avgRating) || 0, votes: Number(data.totalVotes) || 0, ts: Date.now() });
      resolve(ratingCache.get(productId));
    })
    .catch((err) => reject(err))
    .finally(() => {
      activeFetches--;
      processQueueNext();
    });
}

function enqueueFetch(productId) {
  return new Promise((resolve, reject) => {
    // Si está en caché y no caducó, devolver inmediatamente
    const cached = ratingCache.get(productId);
    if (cached && (Date.now() - cached.ts) < RATING_CACHE_TTL_MS) {
      return resolve(cached);
    }

    // Evitar duplicados en cola: si ya hay una tarea para este productId, attach al resultado
    const existing = fetchQueue.find(q => q.productId === productId);
    if (existing) {
      // Enlazamos al finish creando otro resolve que resolverá cuando se procese
      fetchQueue.push({ productId, resolve, reject });
      return processQueueNext();
    }

    fetchQueue.push({ productId, resolve, reject });
    processQueueNext();
  });
}

/**
 * Obtiene rating desde caché o backend (a través de la cola)
 */
async function fetchRatingOnce(productId) {
  const cached = ratingCache.get(productId);
  if (cached && (Date.now() - cached.ts) < RATING_CACHE_TTL_MS) return cached;
  // Enqueue fetch
  return enqueueFetch(productId);
}

export function updateProductUI(productId, avgRating, totalVotes) {
  const nodes = findProductNodes(productId);
  nodes.forEach(node => {
    const avgEl = node.querySelector(`.avg-rating`);
    const votesEl = node.querySelector(`.total-votes`);
    if (avgEl) avgEl.textContent = Number(avgRating).toFixed(2);
    if (votesEl) votesEl.textContent = `${totalVotes} votos`;
  });
  // Re-render stars en todos los nodos
  renderStars(productId, avgRating);
}

/**
 * IntersectionObserver para carga perezosa (lazy load) de ratings.
 * Observa los nodos que tengan .stars y solicita rating cuando entren en viewport.
 */
const ioOptions = { root: null, rootMargin: '200px', threshold: 0 };
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const node = entry.target;
    const productId = node.closest('[id^="product-"]')?.id?.replace('product-', '') || node.closest('[data-product-id]')?.dataset?.productId;
    if (!productId) return;

    // request rating and update UI (but do not block the observer)
    fetchRatingOnce(productId)
      .then((res) => updateProductUI(productId, res.avg, res.votes))
      .catch((err) => {
        // no fatal, dejamos el placeholder
        console.warn('Error lazy fetching rating for', productId, err);
      });

    // Dejar de observar para este elemento: ya pedimos su rating
    io.unobserve(node);
  });
}, ioOptions);

// Helper: observe a node (safe)
function observeStarsNode(node) {
  try {
    if (!node) return;
    io.observe(node);
  } catch (e) {
    // ignore
  }
}

// Fallback: tiempo máximo antes de forzar fetch de todos los restantes
const FALLBACK_FORCE_MS = 1200; // 1.2s


/**
 * Renderiza las 5 estrellas dentro del contenedor .stars.
 * Gestiona clicks (envía rating) y estado disabled mientras haya petición en curso.
 */
export function renderStars(productId, avgRating = 0) {
  // Buscar todos los contenedores que correspondan a este productId
  const nodes = findProductNodes(productId);
  if (!nodes.length) return;

  const full = Math.floor(avgRating);
  const fractional = avgRating - full;

  nodes.forEach((node) => {
    const container = node.querySelector('.stars');
    if (!container) return;

    // Limpia manejadores previos
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.dataset.value = i;
      star.setAttribute('role', 'button');
      star.setAttribute('aria-label', `${i} estrellas`);
      star.style.cursor = 'pointer';

      if (i <= full) star.textContent = '★';
      else if (i === full + 1 && fractional >= 0.5) star.textContent = '⯨'; // aproximación visual a mitad
      else star.textContent = '☆';

      // Hover preview: colorear hasta i sin cambiar el state
      star.addEventListener('mouseenter', () => {
        if (locks.get(productId)) return;
        const siblings = Array.from(container.querySelectorAll('.star'));
        siblings.forEach((s) => {
          const v = Number(s.dataset.value);
          s.textContent = v <= i ? '★' : '☆';
        });
      });
      star.addEventListener('mouseleave', () => {
        // Restaurar según avgRating
        renderStars(productId, avgRating);
      });

      // Click handler (respeta bloqueo por producto)
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (locks.get(productId)) return; // petición en curso
        try {
          // Deshabilitar container visualmente
          container.dataset.loading = 'true';
          container.style.pointerEvents = 'none';
          container.style.opacity = '0.6';
          await sendRating(productId, i);
        } catch (err) {
          // sendRating ya muestra alert en caso de error
        } finally {
          // Restaurar estado (sendRating también lo hace, pero redundancia)
          delete container.dataset.loading;
          container.style.pointerEvents = '';
          container.style.opacity = '';
        }
      });

      // pequeñas animaciones
      star.addEventListener('mouseenter', () => star.style.transform = 'scale(1.08)');
      star.addEventListener('mouseleave', () => star.style.transform = '');

      container.appendChild(star);
    }
  });
}

/**
 * Inicializa widgets de rating para los productos en el DOM.
 * Por defecto busca elementos con id que empiece en "product-".
 */
export async function initRatings(selector = '[id^="product-"]') {
  // Recolecta nodos por selector y por data-product-id
  const nodesSet = new Set();
  const nodesById = Array.from(document.querySelectorAll(selector || '[id^="product-"]'));
  nodesById.forEach(n => nodesSet.add(n));
  const dataNodes = Array.from(document.querySelectorAll('[data-product-id]'));
  dataNodes.forEach(n => nodesSet.add(n));

  const nodes = Array.from(nodesSet);

  // Primera pasada: renderiza placeholders inmediatamente (evita delay visual)
  const productIds = new Set();
  nodes.forEach(node => {
    let productId = null;
    if (node.id && node.id.startsWith('product-')) productId = node.id.replace('product-', '');
    else if (node.dataset && node.dataset.productId) productId = node.dataset.productId;
    if (!productId) return;
    productIds.add(productId);
    // render placeholder stars quickly
    renderStars(productId, 0);
  });

  // Observa nodos .stars para lazy load (prioridad) y para detalle solicitamos de inmediato
  const starsNodes = Array.from(document.querySelectorAll('.stars'));

  // Prioridad: si un nodo está dentro de detail (.detail-container or #product-detail visible) o tiene data-product-id and visible, fetch ahora
  const immediateFetchIds = new Set();
  starsNodes.forEach(st => {
    const productNode = st.closest('[data-product-id]') || st.closest('[id^="product-"]');
    if (!productNode) return;
    const prodId = productNode.dataset.productId || (productNode.id && productNode.id.replace('product-', ''));
    if (!prodId) return;

    // If inside product detail or product-detail element is visible, priority fetch
    const inDetail = !!st.closest('.detail-container') || !!document.getElementById('product-detail') && document.getElementById('product-detail').style.display !== 'none' && st.closest('#product-detail');
    if (inDetail || productNode.dataset.forceImmediate === 'true') {
      immediateFetchIds.add(prodId);
    } else {
      // otherwise observe for lazy load
      observeStarsNode(st);
    }
  });

  // Kick off immediate fetches concurrently (respect concurrency via queue)
  const immediatePromises = Array.from(immediateFetchIds).map(pid => fetchRatingOnce(pid).then(res => updateProductUI(pid, res.avg, res.votes)).catch(err => { console.warn('initRatings immediate fetch failed', pid, err); }));

  // Fallback: after small delay, force fetch for items not yet fetched (ensures ratings appear eventually)
  const remainingIds = Array.from(productIds).filter(pid => !immediateFetchIds.has(pid));
  const fallbackTimer = setTimeout(() => {
    // enqueue remaining ids in batches
    for (const pid of remainingIds) {
      fetchRatingOnce(pid).then(res => updateProductUI(pid, res.avg, res.votes)).catch(err => {});
    }
  }, FALLBACK_FORCE_MS);

  // Await immediate fetches to finish (non-blocking for UI)
  try {
    await Promise.allSettled(immediatePromises);
  } finally {
    clearTimeout(fallbackTimer);
  }
}

// Export por defecto no necesario, pero dejamos referencias globales para compatibilidad con scripts no-module
window.initRatings = initRatings;
window.setApiBase = setApiBase; // útil para debugging desde la consola (p.ej. setApiBase('http://localhost:10000'))

