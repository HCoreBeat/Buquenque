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
        showEmptyCartModal();
        return;
    }

    // Mostrar la sección de pago
    const paymentSection = document.getElementById('payment-section');
    paymentSection.classList.add('active');

    // Crear overlay si no existe
    if (!document.querySelector('.payment-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'payment-overlay';
        overlay.onclick = hidePaymentSection;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('active'), 10);
    }

    // Deshabilitar scroll del body
    document.body.style.overflow = 'hidden';

    // Actualizar el resumen del pedido
    updateOrderSummary();

    // Cerrar el carrito si está abierto
    const cartSidebar = document.getElementById('cart');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
    }
}

function hidePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    paymentSection.classList.remove('active');

    // Eliminar overlay
    const overlay = document.querySelector('.payment-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }

    // Restaurar scroll del body
    document.body.style.overflow = '';
}

function updateOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const orderSummary = document.getElementById('summary-items');
    const paymentTotal = document.getElementById('payment-total');

    if (!orderSummary || !paymentTotal) return;

    // Limpiar y crear la tabla
    orderSummary.innerHTML = cart.map(item => `
        <tr>
            <td class="order-item-name">${item.product.nombre}</td>
            <td class="order-item-quantity">${item.quantity}</td>
            <td class="order-item-price">$${item.product.precio.toFixed(2)}</td>
            <td class="order-item-total">$${(item.product.precio * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    // Calcular total
    const total = cart.reduce((sum, item) => sum + (item.product.precio * item.quantity), 0);
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
        // Simular procesamiento de pago
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Limpiar carrito completamente
        clearCart(); // Esta función está en script.js
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
.payment-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0,0,0,0.5);
    z-index: 2999;
    opacity: 0;
    transition: opacity 0.3s;
    visibility: hidden;
}
.payment-overlay.active {
    opacity: 1;
    visibility: visible;
}
`;
document.head.appendChild(paymentStyle);
