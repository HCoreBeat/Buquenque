document.addEventListener('DOMContentLoaded', () => {
    initializePaymentSystem();
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

function showPaymentSection() {
    closeCart();
    closeSidebar();

    const paymentSection = document.getElementById('payment-section');
    if (!paymentSection) return;

    paymentSection.classList.add('active');
    document.body.style.overflow = 'hidden';
    createPaymentOverlay();
    try {
        updateOrderSummary();
    } catch (error) {
        console.error('Error actualizando resumen:', error);
        showPaymentNotification('Error al cargar los productos', 'error');
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
        const isOnSale = item.product.oferta && item.product.descuento > 0;
        const unitPrice = isOnSale
            ? item.product.precio * (1 - item.product.descuento / 100)
            : item.product.precio;
        const itemTotal = unitPrice * item.quantity;
        total += itemTotal;

        return `
            <tr>
                <td class="order-item-name">
                    ${item.product.nombre}
                    ${isOnSale ? '<span class="order-item-badge">OFERTA</span>' : ''}
                </td>
                <td class="order-item-quantity">${item.quantity}</td>
                <td class="order-item-price">
                    ${isOnSale ? `
                        <span class="original-price">$${item.product.precio.toFixed(2)}</span>
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

async function processPayment(e) {
    e.preventDefault();

    try {
        const cart = getValidatedCart();
        if (cart.length === 0) {
            throw new Error('Tu carrito está vacío');
        }

        const formData = validateForm();
        const orderData = {
            customer: formData,
            items: prepareOrderItems(cart),
            total: calculateOrderTotal(cart),
            date: new Date().toISOString(),
            affiliate: getCurrentAffiliate()
        };

        showPaymentNotification('Procesando tu pedido...', 'loading');
        const response = await sendPaymentToServer(orderData);

        if (!response.success) {
            throw new Error(response.message || 'Error en el pedido');
        }

        clearCart();
        hidePaymentSection();
        showPaymentNotification('¡Pedido confirmado con éxito!', 'success');

    } catch (error) {
        console.error('Error en processPayment:', error);
        showPaymentNotification(error.message, 'error');
    }
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
    return cart.filter(item => item.product && item.quantity > 0);
}

function validateForm() {
    const form = document.getElementById('payment-form');
    const requiredFields = ['full-name', 'email', 'address'];
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
    return cart.map(item => ({
        id: item.product.id || null,
        name: item.product.nombre,
        quantity: item.quantity,
        unitPrice: item.product.oferta
            ? item.product.precio * (1 - item.product.descuento / 100)
            : item.product.precio,
        discount: item.product.oferta ? item.product.descuento : 0
    }));
}

function calculateOrderTotal(cart) {
    return cart.reduce((total, item) => {
        const price = item.product.oferta
            ? item.product.precio * (1 - item.product.descuento / 100)
            : item.product.precio;
        return total + (price * item.quantity);
    }, 0).toFixed(2);
}

async function sendPaymentToServer(orderData) {
    console.log('Enviando pedido:', orderData);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const success = Math.random() > 0.1;

    return {
        success,
        message: success ? 'Pedido procesado correctamente' : 'Error en la transacción',
        orderId: success ? 'ORD-' + Date.now().toString(36).toUpperCase() : null,
        timestamp: new Date().toISOString()
    };
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
