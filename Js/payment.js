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
    }

    injectPaymentStyles();
}

// Función para enviar estadísticas de visualización de página
async function sendPageViewStatistics() {
    try {
        const userData = await gatherUserData();
        const pageLoadTime = window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart;
        
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

    // resetear checkbox de confirmación cada vez que se abre el formulario
    const checkbox = document.getElementById('location-confirm');
    if (checkbox) checkbox.checked = false;

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

    paymentTotal.textContent = `$${total.toFixed(2)}`;
}

let isProcessingPayment = false; // bandera para evitar envíos múltiples

async function processPayment(e) {
    e.preventDefault();

    // protección contra doble envío
    if (isProcessingPayment) {
        console.warn('El pago ya está en proceso, espera un momento.');
        return;
    }

    // chequear checkbox de confirmación de país
    const checkbox = document.getElementById('location-confirm');
    if (checkbox && !checkbox.checked) {
        showPaymentNotification('Marca la casilla después de leer la lista y verificar que tu país aparece entre los compatibles.', 'error');
        return;
    }

    isProcessingPayment = true;
    const submitBtn = e.target.querySelector('.submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    const loadingNotification = showPaymentNotification('Procesando tu pedido...', 'loading');

    try {
        const cart = getValidatedCart();
        if (cart.length === 0) {
            throw new Error('Tu carrito está vacío');
        }

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
        // restaurar bandera y reactivar botón después de unos segundos
        setTimeout(() => {
            isProcessingPayment = false;
            if (submitBtn) submitBtn.disabled = false;
        }, 3000);
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
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
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
    notification.innerHTML = `
        <div class="notification-content">
            ${type === 'loading' ? '<div class="loading-spinner"></div>' : ''}
            <p>${message}</p>
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

function validateCartBeforeCheckout() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        showPaymentNotification('Añade productos al carrito primero', 'error');
        return false;
    }
    return true;
}

function getValidatedCart() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (!Array.isArray(cart)) {
        throw new Error('Formato de carrito inválido');
    }
    // Permitir tanto productos como packs
    return cart.filter(item => (item.product || item.pack) && item.quantity > 0);
}

function validateForm() {
    const form = document.getElementById('payment-form');
    const requiredFields = ['full-name', 'email', 'phone', 'address'];
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
            padding: 15px 25px;
            border-radius: 8px;
            font-weight: 600;
            opacity: 0;
            transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
            z-index: 5000;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            max-width: 400px;
            min-width: 280px;
            text-align: center;
            display: flex;
            align-items: center;
            gap: 12px; /* Espaciado entre elementos */
        }

        /* Animación para mostrar la notificación */
        .payment-notification.show {
            opacity: 1;
            transform: translateX(-50%) translateY(-10px);
        }

        /* Contenido interno de la notificación */
        .payment-notification .notification-content {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-grow: 1;
        }

        /* Estilos diferenciados por tipo de notificación */
        .payment-notification.info {
            background: #2196F3;
            color: white;
        }

        .payment-notification.success {
            background: #2A9D8F;
            color: white;
        }

        .payment-notification.error {
            background: #f44336;
            color: white;
        }

        .payment-notification.loading {
            background: #D4AF37;
            color: white;
        }

        /* Estilos del spinner de carga */
        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            animation: spin 0.8s linear infinite;
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
