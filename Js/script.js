let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = [];
let currentProduct = null;
let categories = [];

// Función para ir al inicio
function goToHome() {
    window.location.hash = '';
    hideProductDetail();
    renderProducts();
}

// Manejo del historial con hash
window.addEventListener('popstate', handleRouteChange);
window.addEventListener('hashchange', handleRouteChange);

function handleRouteChange() {
    const productName = decodeURIComponent(window.location.hash.substring(1));
    if (!productName) {
        hideProductDetail();
    } else {
        showProductDetail(productName);
    }
}

// Cargar productos
async function loadProducts() {
    try {
        const response = await fetch('Json/products.json');
        if (!response.ok) throw new Error('Error al cargar productos');
        const data = await response.json();
        products = data.products;
        
        // Extraer categorías únicas y añadir "Todo"
        categories = ['Todo', ...new Set(products.map(product => product.categoria))];
        renderCategories();
        initPriceFilter();
        renderProducts();
        updateCartCount();
        updateCart();
        
        // Manejar ruta inicial
        if (window.location.hash) {
            handleRouteChange();
        }

        // Configurar eventos del sidebar
        document.getElementById('close-sidebar')?.addEventListener('click', toggleSidebar);
        document.getElementById('menu-toggle')?.addEventListener('click', toggleSidebar);
        document.getElementById('overlay')?.addEventListener('click', toggleSidebar);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los productos. Por favor recarga la página.');
    }
}

// Renderizar categorías
function renderCategories() {
    const sidebarCategories = document.getElementById('sidebar-categories');
    const desktopCategories = document.getElementById('categories-list');
    
    const categoryItems = categories.map(category => `
        <li onclick="filterByCategory('${category}')">
            <i class="fas fa-${getCategoryIcon(category)}"></i>
            ${category}
        </li>
    `).join('');
    
    if (sidebarCategories) sidebarCategories.innerHTML = categoryItems;
    if (desktopCategories) desktopCategories.innerHTML = categoryItems;
}
// Función auxiliar para iconos de categorías
function getCategoryIcon(category) {
    const icons = {
        'todo': 'th-large',
        'electrónica': 'mobile-alt',
        'ropa': 'tshirt',
        'hogar': 'home',
        'deportes': 'running',
        'juguetes': 'gamepad',
        'salud': 'heartbeat',
        'belleza': 'spa',
        'automóviles': 'car',
        'herramientas': 'wrench',
        'comida': 'utensils',
        'bebidas': 'wine-glass-alt',
        'postres': 'cookie-bite',
        'frutas': 'apple-alt',
        'verduras': 'carrot',
        'carnes': 'drumstick-bite',
        'pescado': 'fish',
        'panadería': 'bread-slice',
        'lácteos': 'cheese',
        'cafetería': 'coffee',
        'rápida': 'hamburger',
        'despensa': 'shopping-basket',
        'snacks': 'pizza-slice'
    };

    return icons[category.toLowerCase().trim()] || 'tag'; // Convertimos a minúsculas y eliminamos espacios extra
}


function initPriceFilter() {
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const minPriceSlider = document.getElementById('price-slider-min');
    const maxPriceSlider = document.getElementById('price-slider-max');
    const applyFilterBtn = document.getElementById('apply-price-filter');
    
    if (!minPriceInput || !maxPriceInput || !minPriceSlider || !maxPriceSlider) return;
    
    // Valores iniciales basados en los productos
    const prices = products.map(p => p.precio);
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
    minPriceSlider.addEventListener('input', () => {
        minPriceInput.value = minPriceSlider.value;
        updatePriceSlider();
    });
    
    maxPriceSlider.addEventListener('input', () => {
        maxPriceInput.value = maxPriceSlider.value;
        updatePriceSlider();
    });
    
    // Actualizar sliders cuando se editan los inputs
    minPriceInput.addEventListener('change', () => {
        let value = Math.max(minPrice, Math.min(maxPrice, parseInt(minPriceInput.value) || minPrice));
        minPriceSlider.value = value;
        minPriceInput.value = value;
        updatePriceSlider();
    });
    
    maxPriceInput.addEventListener('change', () => {
        let value = Math.max(minPrice, Math.min(maxPrice, parseInt(maxPriceInput.value) || maxPrice));
        maxPriceSlider.value = value;
        maxPriceInput.value = value;
        updatePriceSlider();
    });
    
    // Aplicar filtros
    applyFilterBtn.addEventListener('click', applyPriceFilter);
    
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
        
        const track = document.querySelector('.price-slider-track');
        if (track) {
            const minPercent = ((minPriceSlider.value - minPrice) / (maxPrice - minPrice)) * 100;
            const maxPercent = ((maxPriceSlider.value - minPrice) / (maxPrice - minPrice)) * 100;
            
            track.style.left = `${minPercent}%`;
            track.style.width = `${maxPercent - minPercent}%`;
        }
    }
    
    // Función para aplicar filtros
    function applyPriceFilter() {
        const minPrice = parseInt(minPriceInput.value) || 0;
        const maxPrice = parseInt(maxPriceInput.value) || Infinity;
        
        const filteredProducts = products.filter(product => {
            const finalPrice = product.oferta && product.descuento > 0 
                ? product.precio * (1 - product.descuento / 100)
                : product.precio;
            return finalPrice >= minPrice && finalPrice <= maxPrice;
        });
        
        renderProducts(filteredProducts);
        closeSidebar();
    }
}

// Filtrar por categoría
function filterByCategory(category) {
    // Ocultar mensaje de no resultados si está visible
    hideNoResultsMessage();
    
    // Limpiar campo de búsqueda
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Ocultar detalle de producto si está visible
    if (document.getElementById('product-detail')?.style.display === 'block') {
        hideProductDetail();
    }
    
    // Filtrar productos
    const filteredProducts = category === 'Todo' 
        ? products 
        : products.filter(product => product.categoria === category);
    
    renderProducts(filteredProducts);
    
    // Cerrar sidebar en móvil
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

// Buscar productos (ahora en tiempo real)
function searchProducts() {
    const searchInput = document.getElementById('search-input');
    const productsContainer = document.getElementById('products-container');
    const noResultsMessage = document.getElementById('no-results-message');
    
    if (!searchInput || !productsContainer) return;
    
    // Ocultar detalle de producto si está visible
    if (document.getElementById('product-detail')?.style.display === 'block') {
        hideProductDetail();
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderProducts();
        hideNoResultsMessage();
        return;
    }
    
    const filteredProducts = products.filter(product => 
        product.nombre.toLowerCase().includes(searchTerm) || 
        product.descripcion.toLowerCase().includes(searchTerm) ||
        product.categoria.toLowerCase().includes(searchTerm)
    );
    
    if (filteredProducts.length > 0) {
        renderProducts(filteredProducts);
        hideNoResultsMessage();
    } else {
        productsContainer.innerHTML = '';
        showNoResultsMessage(searchTerm);
    }
}

function showNoResultsMessage(searchTerm) {
    let noResultsMessage = document.getElementById('no-results-message');
    
    // Crear el mensaje si no existe
    if (!noResultsMessage) {
        noResultsMessage = document.createElement('div');
        noResultsMessage.id = 'no-results-message';
        noResultsMessage.className = 'no-results-container';
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
        document.getElementById('main-content').appendChild(noResultsMessage);
    } else {
        // Actualizar el mensaje existente
        noResultsMessage.querySelector('.no-results-term').textContent = searchTerm;
        noResultsMessage.style.display = 'block';
    }
}

function hideNoResultsMessage() {
    const noResultsMessage = document.getElementById('no-results-message');
    if (noResultsMessage) {
        noResultsMessage.style.display = 'none';
    }
}

// Función para limpiar la búsqueda
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    renderProducts();
    hideNoResultsMessage();
}

// Toggle del menú lateral
function toggleSidebar() {
    if (window.innerWidth > 768) return;
    
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (!sidebar) return;

    const isOpening = !sidebar.classList.contains('active');
    
    // Cerrar carrito si está abierto
    closeCart();
    
    // Alternar estado del sidebar
    sidebar.classList.toggle('active');
    document.body.classList.toggle('sidebar-open', isOpening);

    // Manejar el overlay
    if (isOpening) {
        if (!sidebarOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            overlay.className = 'sidebar-overlay';
            overlay.onclick = closeSidebar;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);
        } else {
            sidebarOverlay.classList.add('active');
        }
    } else {
        closeSidebar();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.classList.remove('active');
        setTimeout(() => {
            if (sidebarOverlay && !sidebarOverlay.classList.contains('active')) {
                sidebarOverlay.remove();
            }
        }, 300);
    }
}

// Mostrar modal de carrito vacío
function showEmptyCartModal() {
    const modal = document.getElementById('empty-cart-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

// Cerrar modal de carrito vacío
function closeEmptyCartModal() {
    const modal = document.getElementById('empty-cart-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Renderizar productos con precios corregidos
function renderProducts(productsToRender = products) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = '';

    productsToRender.forEach(product => {
        const cleanName = product.nombre.replace(/'/g, "\\'");
        const productEl = document.createElement('div');
        productEl.className = 'product-card';
        
        const isOnSale = product.oferta && product.descuento > 0;
        const finalPrice = isOnSale 
            ? (product.precio * (1 - product.descuento/100)).toFixed(2)
            : product.precio.toFixed(2);
        
        productEl.innerHTML = `
            <div class="product-image-container">
                <div class="product-badges">
                    ${product.nuevo ? '<span class="badge nuevo"><i class="fas fa-star"></i> NUEVO</span>' : ''}
                    ${product.oferta ? '<span class="badge oferta"><i class="fas fa-tag"></i> OFERTA</span>' : ''}
                    ${product.mas_vendido ? '<span class="badge mas-vendido"><i class="fas fa-trophy"></i> TOP</span>' : ''}
                </div>
                <img src="Images/products/${product.imagenes[0]}" 
                    class="product-image" 
                    alt="${product.nombre}"
                    onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">
            </div>
            
            <div class="product-info">
                <h3 class="product-title" onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">
                    ${product.nombre}
                </h3>
                
                <div class="price-container">
                    ${isOnSale ? `
                        <span class="original-price">${product.precio.toFixed(2)}cup</span>
                        <span class="discount-percent">-${product.descuento}%</span>
                    ` : ''}
                    <span class="current-price">${finalPrice} cup</span>
                </div>
                
                <div class="quantity-section">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="adjustQuantity(this, -1, '${cleanName}', event)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="product-quantity" id="quantity-${cleanName}">1</span>
                        <button class="quantity-btn" onclick="adjustQuantity(this, 1, '${cleanName}', event)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    
                    <button class="add-to-cart" onclick="addToCart('${cleanName}', false, event)">
                        <i class="fas fa-cart-plus"></i>
                        <span>Añadir al carrito</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(productEl);
    });
}

// Mostrar detalle del producto con precios corregidos
function showProductDetail(productName) {
    window.scrollTo({top: 0});
    const decodedName = decodeURIComponent(productName);
    const product = products.find(p => p.nombre === decodedName);
    if (!product) {
        window.location.hash = '';
        hideProductDetail();
        return;
    }

    window.location.hash = encodeURIComponent(product.nombre);
    
    const detailContainer = document.getElementById('product-detail');
    const productsContainer = document.getElementById('products-container');
    const cleanName = product.nombre.replace(/'/g, "\\'");

    if (!detailContainer || !productsContainer) return;

    const isOnSale = product.oferta && product.descuento > 0;
    const finalPrice = isOnSale 
        ? (product.precio * (1 - product.descuento/100)).toFixed(2)
        : product.precio.toFixed(2);
    const priceSave = isOnSale ? (product.precio - finalPrice).toFixed(2) : 0;

    // Generar badges
    const badges = [];
    if (product.nuevo) badges.push('<span class="detail-badge nuevo"><i class="fas fa-star"></i> Nuevo</span>');
    if (product.oferta) badges.push(`<span class="detail-badge oferta"><i class="fas fa-tag"></i> -${product.descuento}%</span>`);
    if (product.mas_vendido) badges.push('<span class="detail-badge mas-vendido"><i class="fas fa-trophy"></i> Más Vendido</span>');

    // Generar especificaciones
    const specs = [
        `<li><strong>Categoría</strong> ${product.categoria}</li>`,
        `<li><strong>Disponibilidad</strong> ${product.disponibilidad ? 'En stock' : 'Agotado'}</li>`,
        ...(product.especificaciones || []).map(spec => `<li><strong>${spec.key}</strong> ${spec.value}</li>`)
    ];

    detailContainer.innerHTML = `
        <div class="detail-container">
            <div class="detail-gallery">
                <div class="main-image-container">
                    <img src="Images/products/${product.imagenes[0]}" class="main-image" alt="${product.nombre}" id="main-product-image">
                </div>
            </div>
            
            <div class="detail-info">
                <h1 class="detail-title">${product.nombre}</h1>
                ${badges.length ? `<div class="detail-badges">${badges.join('')}</div>` : ''}
                
                <div class="price-section">
                    ${isOnSale ? `
                        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.5rem;">
                            <span class="price-original">${product.precio.toFixed(2)} cup</span>
                            <span class="price-current">Precio: ${finalPrice} cup</span>
                        </div>
                        <div class="price-save">Ahorras ${priceSave} cup (${product.descuento}%)</div>
                    ` : `<span class="price-current">Precio: ${finalPrice} cup</span>`}
                </div>
                
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

                <button class="add-to-cart-btn" onclick="addToCart('${cleanName}', true, event)">
                    <i class="fas fa-cart-plus"></i>
                    Añadir al carrito
                </button>
                
                <div class="product-description">
                    <h4 class="description-title"><i class="fas fa-align-left"></i> Descripción Detallada</h4>
                    <div class="description-content">
                        ${formatProductDescription(product.descripcion)}
                    </div>
                </div>
                
                <div class="product-specs">
                    <h3 class="specs-title"><i class="fas fa-list-ul"></i> Especificaciones</h3>
                    <ul class="specs-list">
                        ${specs.join('')}
                    </ul>
                </div>
            </div>
        </div>
        
        <button class="back-btn" onclick="hideProductDetail()">
            <i class="fas fa-arrow-left"></i> Volver a productos
        </button>
    `;

    productsContainer.style.display = 'none';
    detailContainer.style.display = 'block';
    currentProduct = product;
}

// Función auxiliar para formatear la descripción
function formatProductDescription(description) {
    if (!description) return '<p class="no-description">No hay descripción disponible</p>';
    
    // Dividir en oraciones considerando múltiples signos de puntuación
    const sentences = description.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    return sentences.map(sentence => {
        const trimmedSentence = sentence.trim();
        // Destacar oraciones importantes
        const isImportant = /(garantiza|ideal|perfecto|exclusiv|especial)/i.test(trimmedSentence);
        
        return `
            <div class="description-sentence ${isImportant ? 'important-sentence' : ''}">
                <div class="sentence-icon">
                    <i class="fas ${isImportant ? 'fa-star' : 'fa-angle-right'}"></i>
                </div>
                <div class="sentence-text">
                    ${trimmedSentence}
                    ${!trimmedSentence.endsWith('.') && !trimmedSentence.endsWith('!') && !trimmedSentence.endsWith('?') ? '.' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Función auxiliar para cambiar imagen principal
function changeMainImage(imgSrc) {
    const mainImg = document.getElementById('main-product-image');
    if (mainImg) {
        mainImg.src = `Images/products/${imgSrc}`;
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.style.opacity = '1';
            mainImg.style.transition = 'opacity 0.3s ease';
        }, 10);
    }
}

// Ocultar detalle
// Función para ocultar el detalle del producto
function hideProductDetail() {
    const productsContainer = document.getElementById('products-container');
    const detailContainer = document.getElementById('product-detail');
    
    if (productsContainer) {
        productsContainer.style.display = 'grid';
        productsContainer.style.animation = 'fadeIn 0.4s ease-out';
    }
    
    if (detailContainer) {
        detailContainer.style.display = 'none';
        detailContainer.innerHTML = '';
    }
    
    currentProduct = null;
    window.location.hash = '';
}

// Carrito
function addToCart(productName, fromDetail = false, event) {
    if (event) event.stopPropagation();
    
    const decodedName = decodeURIComponent(productName);
    const product = products.find(p => p.nombre === decodedName);
    if (!product) return;

    let quantity;
    if (fromDetail) {
        quantity = parseInt(document.getElementById('detail-quantity').textContent) || 1;
    } else {
        quantity = parseInt(document.getElementById(`quantity-${productName}`).textContent) || 1;
    }

    const existingItem = cart.find(item => item.product.nombre === decodedName);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ product: product, quantity: quantity });
    }

    updateCart();
    saveCart();
    showCartNotification(decodedName, quantity);
}

function updateCart() {
    const cartItems = document.getElementById('cart-items');
    const totalElement = document.getElementById('total');
    const emptyPanel = document.getElementById('empty-cart-panel');
    const cartSidebar = document.getElementById('cart');
    
    if (!cartItems || !totalElement || !emptyPanel || !cartSidebar) return;
    
    cartItems.innerHTML = '';
    let total = 0;
    
    if (cart.length === 0) {
        cartSidebar.classList.add('empty');
    } else {
        cartSidebar.classList.remove('empty');
        
        cart.forEach((item, index) => {
            // Calcular precio con descuento si aplica
            const isOnSale = item.product.oferta && item.product.descuento > 0;
            const unitPrice = isOnSale 
                ? item.product.precio * (1 - item.product.descuento/100)
                : item.product.precio;
            
            const itemTotal = unitPrice * item.quantity;
            total += itemTotal;
            
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                ${isOnSale ? '<span class="cart-item-badge oferta">OFERTA</span>' : ''}
                <img src="Images/products/${item.product.imagenes[0]}" alt="${item.product.nombre}">
                <div class="cart-item-info">
                    <p>${item.product.nombre}</p>
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
}

function removeFromCart(index, event) {
    if (event) event.stopPropagation();
    
    if (cart[index]) {
        const productName = cart[index].product.nombre;
        cart.splice(index, 1);
        updateCart();
        saveCart();
        
        // Mostrar notificación de eliminación
        showRemoveNotification(productName);
    }
}

function showRemoveNotification(productName) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification removed';
    notification.innerHTML = `
        <p>${productName} eliminado del carrito</p>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
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

function showCartNotification(productName, quantity) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.innerHTML = `
        <p>${quantity}x ${productName} añadido al carrito</p>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Vaciar completamente el carrito
function clearCart() {
    cart = [];
    localStorage.removeItem('cart');
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
    const quantityElement = document.getElementById('detail-quantity');
    if (quantityElement) {
        let quantity = parseInt(quantityElement.textContent) || 1;
        quantity = Math.max(1, quantity + change);
        quantityElement.textContent = quantity;
    }
}

function toggleCart() {
    const cart = document.getElementById('cart');
    const cartOverlay = document.getElementById('cart-overlay');
    
    if (!cart) return;

    const isOpening = !cart.classList.contains('active');
    
    // Cerrar sidebar si está abierto
    closeSidebar();
    
    // Alternar estado del carrito
    cart.classList.toggle('active');
    document.body.classList.toggle('cart-open', isOpening);

    // Manejar el overlay
    if (isOpening) {
        if (!cartOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'cart-overlay';
            overlay.className = 'cart-overlay';
            overlay.onclick = closeCart;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);
        } else {
            cartOverlay.classList.add('active');
        }
    } else {
        closeCart();
    }
}

function closeCart() {
    const cart = document.getElementById('cart');
    const cartOverlay = document.getElementById('cart-overlay');
    
    if (cart && cart.classList.contains('active')) {
        cart.classList.remove('active');
        document.body.classList.remove('cart-open');
    }
    
    if (cartOverlay) {
        cartOverlay.classList.remove('active');
        setTimeout(() => {
            if (cartOverlay && !cartOverlay.classList.contains('active')) {
                cartOverlay.remove();
            }
        }, 300);
    }
}

function updateCartCount() {
    const countElement = document.getElementById('cart-count');
    if (countElement) {
        const count = cart.reduce((acc, item) => acc + item.quantity, 0);
        countElement.textContent = count;
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Cerrar carrito al hacer clic fuera
document.addEventListener('click', (e) => {
    const cart = document.getElementById('cart');
    const cartBtn = document.querySelector('.cart-btn');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    
    // Manejar cierre del carrito
    if (cart && cartBtn && cart.classList.contains('active') && 
        !cart.contains(e.target) && e.target !== cartBtn && !cartBtn.contains(e.target)) {
        closeCart();
    }
    
    // Manejar cierre del sidebar
    if (sidebar && menuToggle && sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
        closeSidebar();
    }
});

/**
 * Abre WhatsApp con mensaje predeterminado
 */
function openWhatsApp() {
    const phoneNumber = '+5355543772';
    const message = encodeURIComponent('Estoy interesado en los productos que vi en su tienda. ¿Podrían ayudarme?');
    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    
    // Abrir en una nueva pestaña
    window.open(url, '_blank');
}

// Estilos para notificación
const style = document.createElement('style');
style.textContent = `
.cart-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--dorado);
    color: var(--negro);
    padding: 1rem 2rem;
    border-radius: 5px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 3000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.cart-notification.show {
    opacity: 1;
}
`;
document.head.appendChild(style);

// Inicialización
document.addEventListener('DOMContentLoaded', loadProducts);
