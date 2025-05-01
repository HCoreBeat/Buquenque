// payment.js
document.addEventListener('DOMContentLoaded', () => {
    // Configurar el evento para el botón de finalizar compra
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', showPaymentSection);
    }

    // Configurar el formulario de pago
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', processPayment);
    }
});

function showPaymentSection() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        alert('Tu carrito está vacío. Añade productos antes de finalizar la compra.');
        return;
    }

    // Mostrar la sección de pago
    const paymentSection = document.getElementById('payment-section');
    paymentSection.classList.add('active');

    // Actualizar el resumen del pedido
    updateOrderSummary();

    // Deshabilitar el carrito mientras el formulario de pago está abierto
    const cartSidebar = document.getElementById('cart');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
    }
}

function hidePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    paymentSection.classList.remove('active');
}

function updateOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const orderSummary = document.getElementById('order-summary');
    const paymentTotal = document.getElementById('payment-total');

    if (!orderSummary || !paymentTotal) return;

    orderSummary.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.product.precio * item.quantity;
        total += itemTotal;

        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';
        itemElement.innerHTML = `
            <div class="order-item-name">${item.product.nombre}</div>
            <div class="order-item-quantity">${item.quantity}</div>
            <div class="order-item-price">$${itemTotal.toFixed(2)}</div>
        `;
        orderSummary.appendChild(itemElement);
    });

    paymentTotal.textContent = total.toFixed(2);
}

async function processPayment(e) {
    e.preventDefault();
    
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        alert('Error: No hay productos en el carrito.');
        return;
    }

    // Obtener datos del formulario
    const formData = {
        name: document.getElementById('full-name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        items: cart,
        total: parseFloat(document.getElementById('payment-total').textContent)
    };

    // Validación básica
    if (!formData.name || !formData.email || !formData.phone || !formData.address) {
        alert('Por favor completa todos los campos requeridos.');
        return;
    }

    try {
        // Aquí normalmente harías una llamada a tu API/backend
        // Simulamos un retraso de red
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Éxito - limpiar carrito y mostrar mensaje
        localStorage.removeItem('cart');
        updateCartCount();
        hidePaymentSection();
        
        // Mostrar notificación de éxito
        showPaymentNotification('¡Pedido realizado con éxito!', 'success');
    } catch (error) {
        console.error('Error al procesar el pago:', error);
        showPaymentNotification('Error al procesar el pedido. Inténtalo de nuevo.', 'error');
    }
}

function showPaymentNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `payment-notification ${type}`;
    notification.innerHTML = `<p>${message}</p>`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Añadir estilos para la notificación
const paymentStyle = document.createElement('style');
paymentStyle.textContent = `
.payment-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 2rem;
    border-radius: 5px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 4000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.payment-notification.success {
    background: #4CAF50;
    color: white;
}
.payment-notification.error {
    background: #f44336;
    color: white;
}
.payment-notification.show {
    opacity: 1;
}
`;
document.head.appendChild(paymentStyle);