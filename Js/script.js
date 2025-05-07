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
    
    if (sidebarCategories) {
        sidebarCategories.innerHTML = categories.map(category => `
            <li onclick="filterByCategory('${category}')">${category}</li>
        `).join('');
    }
    
    if (desktopCategories) {
        desktopCategories.innerHTML = categories.map(category => `
            <li onclick="filterByCategory('${category}')">${category}</li>
        `).join('');
    }
}

// Filtrar por categoría
function filterByCategory(category) {
    const filteredProducts = category === 'Todo' 
        ? products 
        : products.filter(product => product.categoria === category);
    
    renderProducts(filteredProducts);
    
    // Solo intentar cerrar el sidebar si existe y estamos en móvil
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
}

// Buscar productos (ahora en tiempo real)
function searchProducts() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderProducts();
        return;
    }
    
    const filteredProducts = products.filter(product => 
        product.nombre.toLowerCase().includes(searchTerm) || 
        product.descripcion.toLowerCase().includes(searchTerm) ||
        product.categoria.toLowerCase().includes(searchTerm)
    );
    
    renderProducts(filteredProducts);
}

// Toggle del menú lateral
function toggleSidebar() {
    if (window.innerWidth > 768) return;
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (!sidebar) return;
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        document.body.classList.add('no-scroll');
    } else {
        document.body.classList.remove('no-scroll');
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
        
        // Calcular precio original si hay descuento
        const hasDiscount = product.descuento > 0;
        const originalPrice = hasDiscount ? (product.precio / (1 - product.descuento/100)).toFixed(2) : null;
        
        productEl.innerHTML = `
            <div class="product-badges">
                ${product.oferta ? '<span class="badge oferta">OFERTA</span>' : ''}
                ${product.mas_vendido ? '<span class="badge mas-vendido">MÁS VENDIDO</span>' : ''}
            </div>
            <img src="Images/products/${product.imagenes[0]}" 
                 class="product-image" 
                 alt="${product.nombre}"
                 onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">
            <div class="product-info">
                <h3 onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">${product.nombre}</h3>
                <div class="price-container">
                    ${hasDiscount ? `
                        <span class="original-price">$${originalPrice}</span>
                        <span class="discount-percent">-${product.descuento}%</span>
                    ` : ''}
                    <span class="current-price">$${product.precio.toFixed(2)}</span>
                </div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="adjustQuantity(this, -1, '${cleanName}', event)">-</button>
                    <span class="product-quantity" id="quantity-${cleanName}">1</span>
                    <button class="quantity-btn" onclick="adjustQuantity(this, 1, '${cleanName}', event)">+</button>
                </div>
                <button class="add-to-cart" onclick="addToCart('${cleanName}', false, event)">
                    Añadir al Carrito
                </button>
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

    // Calcular precio original si hay descuento
    const hasDiscount = product.descuento > 0;
    const originalPrice = hasDiscount ? (product.precio / (1 - product.descuento/100)).toFixed(2) : null;

    detailContainer.innerHTML = `
        <img src="Images/products/${product.imagenes[0]}" class="detail-image" alt="${product.nombre}">
        <div class="detail-info">
            <h2>${product.nombre}</h2>
            <p class="description">${product.descripcion}</p>
            <div class="price-container">
                ${hasDiscount ? `
                    <span class="original-price">$${originalPrice}</span>
                    <span class="discount-percent">-${product.descuento}%</span>
                ` : ''}
                <span class="current-price">$${product.precio.toFixed(2)}</span>
            </div>
            <p><strong>Categoría:</strong> ${product.categoria}</p>
            <p><strong>Disponibilidad:</strong> ${product.disponibilidad ? 'En stock' : 'Agotado'}</p>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="adjustDetailQuantity(-1, event)">-</button>
                <span class="quantity" id="detail-quantity">1</span>
                <button class="quantity-btn" onclick="adjustDetailQuantity(1, event)">+</button>
            </div>
            <button class="add-to-cart" onclick="addToCart('${cleanName}', true, event)">
                Añadir al Carrito
            </button>
            <button class="back-btn" onclick="goBackToProducts()">← Volver</button>
        </div>
    `;

    productsContainer.style.display = 'none';
    detailContainer.style.display = 'block';
    currentProduct = product;
}

// Volver a los productos
function goBackToProducts() {
    window.location.hash = '';
    hideProductDetail();
}

// Ocultar detalle
function hideProductDetail() {
    const productsContainer = document.getElementById('products-container');
    const detailContainer = document.getElementById('product-detail');
    
    if (productsContainer) productsContainer.style.display = 'grid';
    if (detailContainer) detailContainer.style.display = 'none';
    currentProduct = null;
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
    if (!cartItems || !totalElement) return;
    
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.product.precio * item.quantity;
        total += itemTotal;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <img src="Images/products/${item.product.imagenes[0]}" alt="${item.product.nombre}">
            <div class="cart-item-info">
                <p>${item.product.nombre}</p>
                <p>$${item.product.precio.toFixed(2)} c/u</p>
                <div class="cart-item-controls">
                    <button onclick="updateCartQuantity(${index}, -1, event)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index}, 1, event)">+</button>
                </div>
                <p>Total: $${itemTotal.toFixed(2)}</p>
            </div>
        `;
        cartItems.appendChild(itemEl);
    });
    
    totalElement.textContent = total.toFixed(2);
    updateCartCount();
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
    const overlay = document.querySelector('.overlay');
    
    if (cart) {
        cart.classList.toggle('active');
        
        if (cart.classList.contains('active')) {
            document.body.classList.add('no-scroll');
            if (!overlay) {
                const newOverlay = document.createElement('div');
                newOverlay.className = 'overlay';
                newOverlay.onclick = toggleCart;
                document.body.appendChild(newOverlay);
            }
            setTimeout(() => {
                const overlay = document.querySelector('.overlay');
                if (overlay) overlay.classList.add('active');
            }, 10);
        } else {
            document.body.classList.remove('no-scroll');
            if (overlay) {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 300);
            }
        }
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
    
    if (cart && cartBtn && !cart.contains(e.target) && e.target !== cartBtn && !cartBtn.contains(e.target)) {
        cart.classList.remove('active');
        document.body.classList.remove('no-scroll');
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    }
});

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
