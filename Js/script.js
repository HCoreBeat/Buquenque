let cart = JSON.parse(localStorage.getItem('cart')) || [];
let products = [];
let currentProduct = null;

// Función para ir al inicio
function goToHome() {
    window.location.hash = '';
    hideProductDetail();
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
        renderProducts();
        updateCartCount();
        updateCart();
        
        // Manejar ruta inicial
        if (window.location.hash) {
            handleRouteChange();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los productos. Por favor recarga la página.');
    }
}

// Renderizar productos
function renderProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = '';

    products.forEach(product => {
        const cleanName = product.nombre.replace(/'/g, "\\'");
        const productEl = document.createElement('div');
        productEl.className = 'product-card';
        productEl.innerHTML = `
            <div class="product-badges">
                ${product.oferta ? '<span class="badge oferta">OFERTA</span>' : ''}
                ${product.mas_vendido ? '<span class="badge mas-vendido">MÁS VENDIDO</span>' : ''}
            </div>
            <img src="images/products/${product.imagenes[0]}" 
                 class="product-image" 
                 alt="${product.nombre}"
                 onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">
            <div class="product-info">
                <h3 onclick="showProductDetail('${encodeURIComponent(product.nombre)}')">${product.nombre}</h3>
                <div class="price-container">
                    ${product.descuento > 0 ? `
                        <span class="original-price">$${(product.precio / (1 - product.descuento/100)).toFixed(2)}</span>
                        <span class="discount-percent">-${product.descuento}%</span>
                    ` : ''}
                    <span class="current-price">$${product.precio.toFixed(2)}</span>
                </div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="adjustQuantity(this, -1, event)">-</button>
                    <span class="quantity">1</span>
                    <button class="quantity-btn" onclick="adjustQuantity(this, 1, event)">+</button>
                </div>
                <button class="add-to-cart" onclick="addToCart('${cleanName}')">
                    Añadir al Carrito
                </button>
            </div>
        `;
        container.appendChild(productEl);
    });
}

// Mostrar detalle del producto
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

    detailContainer.innerHTML = `
        <img src="images/products/${product.imagenes[0]}" class="detail-image" alt="${product.nombre}">
        <div class="detail-info">
            <h2>${product.nombre}</h2>
            <p class="description">${product.descripcion}</p>
            <div class="price-container">
                ${product.descuento > 0 ? `
                    <span class="original-price">$${(product.precio / (1 - product.descuento/100)).toFixed(2)}</span>
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
            <button class="add-to-cart" onclick="addToCart('${cleanName}', true)">
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
function addToCart(productName, fromDetail = false) {
    const decodedName = decodeURIComponent(productName);
    const product = products.find(p => p.nombre === decodedName);
    if (!product) return;

    const quantity = fromDetail 
        ? parseInt(document.getElementById('detail-quantity').textContent)
        : parseInt(document.querySelector('.product-card.active .quantity')?.textContent || 1);

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
            <img src="images/products/${item.product.imagenes[0]}" alt="${item.product.nombre}">
            <div class="cart-item-info">
                <p>${item.product.nombre}</p>
                <p>$${item.product.precio.toFixed(2)} c/u</p>
                <div class="cart-item-controls">
                    <button onclick="updateCartQuantity(${index}, -1, event)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index}, 1, event)">+</button>
                </div>
                <p>$${itemTotal.toFixed(2)}</p>
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

// Funciones auxiliares
function adjustQuantity(btn, change, event) {
    if (event) event.stopPropagation();
    const quantityElement = btn.parentElement.querySelector('.quantity');
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
    if (cart) {
        cart.classList.toggle('active');
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