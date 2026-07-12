const BACKEND = 'https://backend-buquenque.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    initializePaymentSystem();
    sendPageViewStatistics(); // Enviar estadísticas al cargar la página
});

function initializePaymentSystem() {
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (validateCartBeforeCheckout()) {
                showPaymentSection();
            }
        });
    }

    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', processPayment);
        paymentForm.addEventListener('click', handlePaymentSubmitClick);
    }

    injectPaymentStyles();
}

function handlePaymentSubmitClick(e) {
    const submitBtn = e.target.closest('.submit-btn');
    if (!submitBtn) return;

    const form = submitBtn.closest('form');
    if (!form) return;

    if (isProcessingPayment || form.getAttribute('data-submitting') === 'true') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }

    // Quick client-side check: require the user to confirm their country
    const checkbox = document.getElementById('location-confirm');
    if (checkbox && !checkbox.checked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showPaymentNotification('Marca la casilla después de leer la lista y verificar que tu país aparece entre los compatibles.', 'error');
        return;
    }

    // Do not call beginPaymentSubmission here; let the submit handler
    // (`processPayment`) start the submission flow so there's a single
    // place that sets and resets the submitting state.
}

function beginPaymentSubmission(form, submitBtn) {
    if (!form) return;

    form.setAttribute('data-submitting', 'true');
    isProcessingPayment = true;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent.trim();
        submitBtn.textContent = 'Procesando...';
    }
}

function createProcessingOverlay() {
    if (document.querySelector('.processing-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'processing-overlay';
    // prevent pointer events to underlying content
    overlay.style.pointerEvents = 'auto';
    document.body.appendChild(overlay);
    // ensure no background scroll
    document.body.style.overflow = 'hidden';
    setTimeout(() => overlay.classList.add('active'), 10);
}

function removeProcessingOverlay() {
    const overlay = document.querySelector('.processing-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.remove();
        // restore body scroll only if no other modal/overlay is active
        const modal = document.getElementById('order-confirmation-modal');
        const paymentSection = document.getElementById('payment-section');
        if (!(modal && modal.classList.contains('active')) && !(paymentSection && paymentSection.classList.contains('active'))) {
            document.body.style.overflow = '';
        }
    }, 260);
}

function resetPaymentSubmissionState(form = document.getElementById('payment-form')) {
    const submitBtn = form?.querySelector('.submit-btn');

    if (form) {
        form.removeAttribute('data-submitting');
        form.classList.remove('is-submitting');
    }

    isProcessingPayment = false;

    if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.dataset.originalText) {
            submitBtn.textContent = submitBtn.dataset.originalText;
        }
    }
}

// Función para enviar estadísticas de visualización de página
async function sendPageViewStatistics() {
    try {
        const userData = await gatherUserData();
        // Obtenemos los datos de navegación
        const navEntry = performance.getEntriesByType('navigation')[0];

        // Calculamos la diferencia
        const pageLoadTime = navEntry.domContentLoadedEventEnd - navEntry.startTime;
        
        const statsData = {
            ip: userData.ip,
            pais: userData.country,
            origen: window.location.href,
            afiliado: getCurrentAffiliate()?.nombre || "Ninguno",
            tiempo_carga_pagina_ms: pageLoadTime,
            navegador: getBrowserInfo(),
            sistema_operativo: getOSInfo(),
            fuente_trafico: document.referrer || "Directo"
        };

        await sendStatisticsToBackend(statsData);
    } catch (error) {
        console.error('Error enviando estadísticas de página:', error);
    }
}

// Función para obtener datos del usuario
async function gatherUserData() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Error obteniendo datos de IP');
        return await response.json();
    } catch (error) {
        console.error('Error obteniendo datos del usuario:', error);
        return {
            ip: 'Desconocido',
            country: 'Desconocido'
        };
    }
}

// Función para enviar datos al backend
async function sendStatisticsToBackend(data) {
    try {
        const response = await fetch(`${BACKEND}/guardar-estadistica`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Error enviando estadísticas');
        }

        return await response.json();
    } catch (error) {
        console.error('Error en sendStatisticsToBackend:', error);
        throw error;
    }
}

// Funciones auxiliares para obtener información del navegador y SO
function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browser = "Desconocido";
    
    if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("SamsungBrowser")) browser = "Samsung Browser";
    else if (userAgent.includes("Opera") || userAgent.includes("OPR")) browser = "Opera";
    else if (userAgent.includes("Trident")) browser = "Internet Explorer";
    else if (userAgent.includes("Edge")) browser = "Edge";
    else if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Safari")) browser = "Safari";
    
    return browser;
}

function getOSInfo() {
    const userAgent = navigator.userAgent;
    let os = "Desconocido";
    
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "MacOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
    
    return os;
}

function showPaymentSection() {
    // Asegúrate de que estas funciones (closeCart, closeSidebar) existan en tu código
    if (typeof closeCart === 'function') closeCart();
    if (typeof closeSidebar === 'function') closeSidebar();

    const paymentSection = document.getElementById('payment-section');
    if (!paymentSection) return;

    paymentSection.classList.add('active');
    document.body.style.overflow = 'hidden';
    createPaymentOverlay();
    
    // Inicializar autocompletado de datos de pago
    if (typeof paymentAutofill !== 'undefined') {
        paymentAutofill.initialize();
    }
    
    try {
        updateOrderSummary();
    } catch (error) {
        console.error('Error actualizando resumen:', error);
        showPaymentNotification('Error al cargar los productos', 'error');
    }

    resetPaymentSubmissionState();

    // cargar lista de países compatibles
    loadPaymentCountryList();
}

/**
 * Muestra en el formulario el listado de países compatibles
a partir del JSON de configuración.
 */
async function loadPaymentCountryList() {
    const container = document.getElementById('payment-country-list');
    if (!container) return;

    try {
        const resp = await fetch('Json/pay.json');
        if (!resp.ok) throw new Error('No se pudo cargar el listado de países');
        const data = await resp.json();

        let html = '<p>Por favor revisa cuidadosamente el listado y confirma que tu país está incluido. Países compatibles con nuestros métodos de pago:</p>';
        if (Array.isArray(data.iban_countries)) {
            html += '<h4>IBAN</h4><ul>' + data.iban_countries.map(c => `<li>${c}</li>`).join('') + '</ul>';
        }
        if (Array.isArray(data.zelle_countries)) {
            html += '<h4>Zelle</h4><ul>' + data.zelle_countries.map(c => `<li>${c}</li>`).join('') + '</ul>';
        }

        container.innerHTML = html;
    } catch (err) {
        console.error('Error cargando países de pago:', err);
        container.innerHTML = '<p>No se pudo cargar la lista de países compatibles.</p>';
    }
}


function hidePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    if (paymentSection) {
        paymentSection.classList.remove('active');
    }

    document.body.style.overflow = '';
    removePaymentOverlay();
}

function updateOrderSummary() {
    const orderSummary = document.getElementById('summary-items');
    const paymentTotal = document.getElementById('payment-total');

    if (!orderSummary || !paymentTotal) {
        throw new Error('Elementos del resumen no encontrados');
    }

    const cart = getValidatedCart();
    let total = 0;
    const minimumBanner = document.getElementById('payment-minimum-banner');
    const submitBtn = document.getElementById('payment-form')?.querySelector('.submit-btn');

    orderSummary.innerHTML = cart.map(item => {
        // Determinar si es pack o producto
        const isPack = item.isPack || item.pack;
        const itemData = isPack ? item.pack : item.product;
        
        if (!itemData) return '';
        
        const isOnSale = itemData.oferta && itemData.descuento > 0;
        const unitPrice = isOnSale
            ? itemData.precio * (1 - itemData.descuento / 100)
            : itemData.precio;
        const itemTotal = unitPrice * item.quantity;
        total += itemTotal;

        const itemType = isPack ? '<span class="item-type-badge pack-badge">Pack</span>' : '';

        return `
            <tr class="${isPack ? 'order-item-pack' : 'order-item-product'}">
                <td class="order-item-name">
                    ${itemData.nombre}
                    ${itemType}
                    ${isOnSale ? '<span class="order-item-badge">OFERTA</span>' : ''}
                </td>
                <td class="order-item-quantity">${item.quantity}</td>
                <td class="order-item-price">
                    ${isOnSale ? `
                        <span class="original-price">$${itemData.precio.toFixed(2)}</span>
                        <span class="discounted-price">$${unitPrice.toFixed(2)}</span>
                    ` : `$${unitPrice.toFixed(2)}`}
                </td>
                <td class="order-item-total">$${itemTotal.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const affiliate = getCurrentAffiliate();
    if (affiliate) {
        orderSummary.innerHTML += `
            <tr class="affiliate-info">
                <td colspan="3">Referido por:</td>
                <td> (${affiliate.id})</td>
            </tr>
        `;
    }

    if (minimumBanner) {
        const isMet = total >= MINIMUM_ORDER_TOTAL;
        const remaining = Math.max(0, MINIMUM_ORDER_TOTAL - total);
        minimumBanner.classList.toggle('warning', !isMet);
        minimumBanner.classList.toggle('ok', isMet);
        minimumBanner.innerHTML = `
            <i class="fas ${isMet ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${isMet ? 'Tu pedido cumple con el mínimo de 10 <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs">.' : `Faltan <strong>${remaining.toFixed(2)}</strong> <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs"> para alcanzar el mínimo de pedido.`}</span>
        `;
    }

    if (submitBtn) {
        const canSubmit = total >= MINIMUM_ORDER_TOTAL;
        submitBtn.disabled = !canSubmit;
        submitBtn.classList.toggle('disabled', !canSubmit);
        submitBtn.textContent = canSubmit ? 'Confirmar Pedido' : 'Completa el mínimo de 10 Zelle';
    }

    paymentTotal.textContent = `$${total.toFixed(2)}`;
}

let isProcessingPayment = false; // bandera para evitar envíos múltiples

async function processPayment(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form?.querySelector('.submit-btn');

    // protección contra doble envío
    if (isProcessingPayment || form?.getAttribute('data-submitting') === 'true') {
        console.warn('El pago ya está en proceso, espera un momento.');
        return;
    }

    // chequear checkbox de confirmación de país BEFORE starting submission
    const checkbox = document.getElementById('location-confirm');
    if (checkbox && !checkbox.checked) {
        showPaymentNotification('Marca la casilla después de leer la lista y verificar que tu país aparece entre los compatibles.', 'error');
        return;
    }

    // validar carrito antes de bloquear UI
    let cart;
    try {
        cart = getValidatedCart();
        if (cart.length === 0) {
            showPaymentNotification('Tu carrito está vacío', 'error');
            return;
        }

        const cartTotalValue = cart.reduce((sum, item) => {
            const itemData = item.product || item.pack;
            if (!itemData) return sum;
            const price = itemData.oferta
                ? itemData.precio * (1 - itemData.descuento / 100)
                : itemData.precio;
            return sum + (price * item.quantity);
        }, 0);

        if (cartTotalValue < MINIMUM_ORDER_TOTAL) {
            const remaining = (MINIMUM_ORDER_TOTAL - cartTotalValue).toFixed(2);
            showPaymentNotification(`El pedido mínimo es de 10 <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs">. Faltan ${remaining} <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs"> para continuar.`, 'error');
            return;
        }
    } catch (err) {
        showPaymentNotification('Error validando el carrito: ' + (err.message || err), 'error');
        return;
    }

    // Ahora sí iniciamos la UX de envío para evitar condiciones de carrera
    beginPaymentSubmission(form, submitBtn);
    // block UI visually while processing
    try { createProcessingOverlay(); } catch (e) { console.warn(e); }

    const loadingNotification = showPaymentNotification('Procesando tu pedido...', 'loading');

    try {
        // usamos la variable `cart` validada arriba

        const formData = validateForm(); // Info del cliente del formulario
        const userData = await gatherUserData(); // Info de IP y país
        const affiliateInfo = getCurrentAffiliate(); // Objeto de afiliado

        // Guardar datos de pago en localStorage para futuro autocompletado
        if (typeof paymentAutofill !== 'undefined') {
            paymentAutofill.saveData(
                formData['full-name'],
                formData.email,
                formData.phone
            );
        }

        // Prepara el payload completo que se enviará al backend y luego a Apps Script
        const orderPayload = {
            ip: userData.ip,
            pais: userData.country,
            origen: window.location.href,
            afiliado: affiliateInfo?.nombre || "Ninguno", // Nombre del afiliado (string)
            nombre_comprador: formData['full-name'],
            telefono_comprador: formData.phone || "N/A",
            correo_comprador: formData.email,
            direccion_envio: formData.address,
            nombre_persona_entrega: formData['delivery-person'],
            telefono_persona_entrega: formData['delivery-phone'],
            compras: prepareOrderItems(cart), // Artículos del carrito formateados
            precio_compra_total: calculateOrderTotal(cart), // Precio total
            navegador: getBrowserInfo(), // Info del navegador
            sistema_operativo: getOSInfo(), // Info del SO
            fuente_trafico: document.referrer || "Directo", // Fuente de tráfico
            fecha_pedido: new Date().toISOString() // Marca de tiempo del pedido
        };
        // envar las estadstcas de peddo al server de estadstcas
        await sendStatisticsToBackend(orderPayload);

        // Envía el payload completo al backend (que lo reenvía a Apps Script)
        const response = await sendPaymentToServer(orderPayload); // <--- CAMBIO CLAVE AQUÍ

        if (!response.success) {
            throw new Error(response.message || 'Error en el pedido');
        }

        // Cerrar notificación de carga primero
        if (loadingNotification) {
            loadingNotification.classList.remove('show');
            setTimeout(() => loadingNotification.remove(), 300);
        }

        clearCart();
        hidePaymentSection();
        showOrderConfirmationModal();

    } catch (error) {
        console.error('Error en processPayment:', error);
        // Cerrar notificación de carga si hay error
        if (loadingNotification) {
            loadingNotification.classList.remove('show');
            setTimeout(() => {
                loadingNotification.remove();
                showPaymentNotification(error.message, 'error');
            }, 300);
        }
    } finally {
        setTimeout(() => {
            resetPaymentSubmissionState(form);
            try { removeProcessingOverlay(); } catch (e) { /* ignore */ }
        }, 1500);
    }
}

function showOrderConfirmationModal() {
    const modal = document.getElementById('order-confirmation-modal');
    if (!modal) return;
    
    // Generar número de referencia único
    const orderReference = generateOrderReference();
    const referenceElement = document.getElementById('order-reference-number');
    if (referenceElement) {
        referenceElement.textContent = orderReference;
    }
    
    // prevent background scroll and ensure modal is on top
    document.body.style.overflow = 'hidden';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

/**
 * Genera un número de referencia único para la orden
 */
function generateOrderReference() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `#ORD-${year}${month}${day}${random}`;
}

// También necesitamos la función para cerrar el modal (ya está en el HTML pero no en el JS)
function closeConfirmationAndGoHome() {
    const modal = document.getElementById('order-confirmation-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        // Asegúrate de que goToHome() exista en tu script.js o donde sea
        // restore body scroll
        document.body.style.overflow = '';
        if (typeof goToHome === 'function') goToHome(); 
    }, 300);
}

function showPaymentNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.payment-notification');
    existingNotifications.forEach(notification => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });

    const notification = document.createElement('div');
    notification.className = `payment-notification ${type}`;

    const titleMap = {
        loading: 'Procesando',
        success: 'Pedido recibido',
        error: 'Error',
        info: 'Información'
    };

    // Use simple glyphs and a CSS spinner instead of inline SVGs (improves contrast and reliability)
    const glyphs = {
        loading: '<div class="loading-spinner" aria-hidden="true"></div>',
        success: '<span class="notification-glyph">✓</span>',
        error: '<span class="notification-glyph">✕</span>',
        info: '<span class="notification-glyph">ℹ</span>'
    };

    const iconHTML = glyphs[type] || glyphs.info;
    const title = titleMap[type] || titleMap.info;

    notification.innerHTML = `
        <div class="notification-icon">${iconHTML}</div>
        <div class="notification-body">
            <div class="notification-title">${title}</div>
            <div class="notification-text">${message}</div>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    if (type !== 'loading') {
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    return notification;
}

function getCurrentCartItemData(cartItem) {
    const itemData = cartItem.product || cartItem.pack;
    if (!itemData) return null;

    if (cartItem.pack) {
        return itemData;
    }

    const itemId = itemData.id != null ? String(itemData.id) : null;
    const productList = typeof products !== 'undefined' && Array.isArray(products)
        ? products
        : (Array.isArray(window.products) ? window.products : []);

    if (itemId && Array.isArray(productList)) {
        let match = productList.find((p) => p.id && String(p.id) === itemId);
        if (match) {
            if (match.isGrouped && Array.isArray(match.variants)) {
                const variantMatch = match.variants.find((v) => v.id && String(v.id) === itemId);
                return variantMatch || match;
            }
            return match;
        }

        for (const p of productList) {
            if (p.isGrouped && Array.isArray(p.variants)) {
                const variantMatch = p.variants.find((v) => v.id && String(v.id) === itemId);
                if (variantMatch) return variantMatch;
            }
        }
    }

    if (itemData.nombre && Array.isArray(productList)) {
        const nameMatch = productList.find((p) => p.nombre === itemData.nombre);
        if (nameMatch) return nameMatch;

        const variantMatch = productList
            .flatMap((p) => (p.isGrouped ? p.variants : []))
            .find((v) => v.nombre === itemData.nombre);
        if (variantMatch) return variantMatch;
    }

    return null;
}

function getCurrentCartCart() {
    if (typeof cart !== 'undefined' && Array.isArray(cart)) {
        return cart;
    }

    const storedCart = JSON.parse(localStorage.getItem('cart')) || [];
    return Array.isArray(storedCart) ? storedCart : [];
}

function getUnavailableCartItems() {
    const cartItems = getCurrentCartCart();
    if (!Array.isArray(cartItems)) {
        return [];
    }

    return cartItems.filter(item => {
        const itemData = item.product || item.pack;
        if (!itemData || item.quantity <= 0) return false;
        return !isAvailableForPayment(item);
    });
}

function isAvailableForPayment(cartItem) {
    const itemData = cartItem.product || cartItem.pack;
    if (!itemData || cartItem.quantity <= 0) return false;
    if (cartItem.pack) {
        return itemData.disponible !== false;
    }
    const currentData = getCurrentCartItemData(cartItem);
    return currentData ? currentData.disponibilidad !== false : false;
}

function validateCartBeforeCheckout() {
    // Validar si hay un mensaje bloqueando el checkout
    if (messageNotificationSystem && messageNotificationSystem.isWithinDateRange && messageNotificationSystem.messageData) {
        showPaymentNotification('⚠️ ' + messageNotificationSystem.messageData.mensaje, 'error');
        return false;
    }

    const unavailableItems = getUnavailableCartItems();
    if (unavailableItems.length > 0) {
        const plural = unavailableItems.length > 1 ? 'productos no disponibles' : 'producto no disponible';
        showPaymentNotification(`Hay ${unavailableItems.length} ${plural} en el carrito. Elimínalos para continuar.`, 'error');
        return false;
    }

    const cart = getValidatedCart();
    if (cart.length === 0) {
        showPaymentNotification('No hay productos disponibles para pagar. Añade productos disponibles al carrito.', 'error');
        return false;
    }

    const cartTotalValue = cart.reduce((sum, item) => {
        const itemData = item.product || item.pack;
        if (!itemData) return sum;
        const price = itemData.oferta
            ? itemData.precio * (1 - itemData.descuento / 100)
            : itemData.precio;
        return sum + (price * item.quantity);
    }, 0);

    if (cartTotalValue < MINIMUM_ORDER_TOTAL) {
        const remaining = (MINIMUM_ORDER_TOTAL - cartTotalValue).toFixed(2);
        showPaymentNotification(`El pedido mínimo es de 10 <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs">. Faltan ${remaining} <img src="Images/zelle_oscuro.svg" alt="Zelle" class="currency-icon price-xs"> para continuar.`, 'error');
        return false;
    }

    return true;
}

function getValidatedCart() {
    const cartItems = getCurrentCartCart();
    if (!Array.isArray(cartItems)) {
        throw new Error('Formato de carrito inválido');
    }

    return cartItems.filter(item => {
        const itemData = item.product || item.pack;
        if (!itemData || item.quantity <= 0) return false;
        return isAvailableForPayment(item);
    });
}

function validateForm() {
    const form = document.getElementById('payment-form');
    const requiredFields = ['full-name', 'email', 'phone', 'address', 'delivery-person', 'delivery-phone'];
    const formData = {};

    requiredFields.forEach(field => {
        const value = form.querySelector(`[name="${field}"]`)?.value.trim();
        if (!value) {
            throw new Error(`Por favor completa el campo ${field.replace('-', ' ')}`);
        }
        formData[field] = value;
    });

    return formData;
}

function prepareOrderItems(cart) {
    return cart.map(item => {
        const isPack = item.isPack || item.pack;
        const itemData = isPack ? item.pack : item.product;
        
        if (!itemData) return null;
        
        return {
            id: itemData.id || null,
            name: itemData.nombre,
            quantity: item.quantity,
            type: isPack ? 'pack' : 'product',
            unitPrice: itemData.oferta
                ? itemData.precio * (1 - itemData.descuento / 100)
                : itemData.precio,
            discount: itemData.oferta ? itemData.descuento : 0
        };
    }).filter(item => item !== null);
}

function calculateOrderTotal(cart) {
    return cart.reduce((total, item) => {
        const isPack = item.isPack || item.pack;
        const itemData = isPack ? item.pack : item.product;
        
        if (!itemData) return total;
        
        const price = itemData.oferta
            ? itemData.precio * (1 - itemData.descuento / 100)
            : itemData.precio;
        return total + (price * item.quantity);
    }, 0).toFixed(2);
}

// Esta función ahora enviará el payload completo a tu backend Node.js
async function sendPaymentToServer(orderPayload) { // <-- Ahora recibe el payload completo
    console.log('Enviando pedido a tu backend Node.js:', orderPayload);
    
    try {
        const response = await fetch(`${BACKEND}/send-pedido`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del backend: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error en sendPaymentToServer (frontend):', error);
        throw error;
    }
}

function createPaymentOverlay() {
    if (document.querySelector('.payment-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'payment-overlay';
    overlay.onclick = hidePaymentSection;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('active'), 10);
}

function removePaymentOverlay() {
    const overlay = document.querySelector('.payment-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

function injectPaymentStyles() {
    const styleId = 'payment-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Estilos generales de las notificaciones */
        .payment-notification {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 14px 22px;
            border-radius: 12px;
            font-weight: 700;
            opacity: 0;
            transition: opacity 0.28s cubic-bezier(0.2,0,0,1), transform 0.28s cubic-bezier(0.2,0,0,1);
            z-index: 10002; /* sitúa la notificación por encima del overlay */
            box-shadow: 0 10px 30px rgba(12,24,36,0.18);
            max-width: 460px;
            min-width: 260px;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 12px;
            backdrop-filter: blur(6px);
            border: 1px solid rgba(255,255,255,0.06);
            background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,250,0.96));
            color: var(--negro);
        }

        /* Professional notification layout */
        .payment-notification {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .payment-notification.show {
            opacity: 1;
            transform: translateX(-50%) translateY(-10px);
        }

        .payment-notification .notification-icon {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.92);
            box-shadow: 0 3px 10px rgba(12,24,36,0.08);
            color: var(--negro);
        }

        .payment-notification .notification-body {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .payment-notification .notification-title {
            font-size: 0.98rem;
            font-weight: 800;
            color: var(--negro);
            line-height: 1;
        }

        .payment-notification .notification-text {
            font-size: 0.9rem;
            color: rgba(12,24,36,0.8);
            line-height: 1.2;
            max-width: 360px;
        }

        /* Variants using project palette variables - use solid icon backgrounds for contrast */
        .payment-notification.info { border-color: rgba(21,101,192,0.12); }
        .payment-notification.info .notification-icon { background: var(--azul-destacado, #1565c0); color: #fff; }
        .payment-notification.success { border-color: rgba(46,125,50,0.12); }
        .payment-notification.success .notification-icon { background: var(--verde-oscuro, #2e7d32); color: #fff; }
        .payment-notification.error { border-color: rgba(198,40,40,0.12); }
        .payment-notification.error .notification-icon { background: var(--rojo-oscuro, #c62828); color: #fff; }
        .payment-notification.loading { border-color: rgba(255,206,18,0.12); }
        .payment-notification.loading .notification-icon { background: var(--botonA, #fdd835); color: #111; }

        /* Glyph inside the icon */
        .notification-glyph {
            font-size: 1.05rem;
            font-weight: 800;
            line-height: 1;
            display: inline-block;
        }

        /* Estilos del spinner de carga */
        .loading-spinner {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 4px solid rgba(255,255,255,0.35);
            border-top-color: currentColor; /* visible against colored icon background */
            animation: spin 0.8s linear infinite;
            box-sizing: border-box;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Superposición de pago para bloquear la interacción */
        .payment-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0,0,0,0.6);
            z-index: 2999;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            pointer-events: none;
        }

        .payment-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        /* Overlay específico para cuando se está procesando el pago */
        .processing-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0,0,0,0.55);
            z-index: 9000; /* debajo de las notificaciones */
            opacity: 0;
            transition: opacity 0.25s ease-in-out, transform 0.25s ease-in-out;
            pointer-events: none;
            display: block;
        }

        .processing-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        /* Información del afiliado */
        .affiliate-info {
            background-color: #f8f9fa;
            font-weight: bold;
            text-align: center;
        }

        .affiliate-info td {
            padding: 10px;
            border-top: 1px solid #ddd;
            font-size: 14px;
        }
    `;

    document.head.appendChild(style);
}
