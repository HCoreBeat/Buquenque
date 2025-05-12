// payment.js
document.addEventListener('DOMContentLoaded', () => {
    // Configurar el evento para el botón de finalizar compra
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showPaymentSection();
        });
    }

    // Configurar el formulario de pago
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', processPayment);
    }
});

function showPaymentSection() {
    // Cerrar el carrito si está abierto
    closeCart();
    
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
    
    // Actualizar el resumen del pedido con precios correctos
    updateOrderSummary();
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
    const orderSummary = document.getElementById('summary-items');
    const paymentTotal = document.getElementById('payment-total');
    
    if (!orderSummary || !paymentTotal) return;
    
    // Obtener el carrito del localStorage
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    let total = 0;
    orderSummary.innerHTML = cart.map(item => {
        const isOnSale = item.product.oferta && item.product.descuento > 0;
        const unitPrice = isOnSale 
            ? item.product.precio * (1 - item.product.descuento/100)
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
    
    paymentTotal.textContent = total.toFixed(2);
} 

async function processPayment(e) {
    if (e) e.preventDefault();
    
    try {
        // Validar carrito
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart.length === 0) {
            showPaymentNotification('Tu carrito está vacío', 'error');
            return;
        }
        
        // Simular procesamiento (remover en producción)
        showPaymentNotification('Procesando pago...', 'info');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Limpiar y mostrar confirmación
        clearCart();
        hidePaymentSection();
        showOrderConfirmation();
        
    } catch (error) {
        console.error('Error en processPayment:', error);
        showPaymentNotification('Error al procesar el pago', 'error');
    }
}

// Función para mostrar confirmación de pedido
function showOrderConfirmation() {
    try {
        // Cerrar otros modales primero
        hidePaymentSection();
        closeCart();
        closeEmptyCartModal();
        
        const modal = document.getElementById('order-confirmation-modal');
        if (!modal) {
            console.error('Elemento order-confirmation-modal no encontrado');
            return;
        }
        
        // Configurar el modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Pequeño retraso para la animación
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
    } catch (error) {
        console.error('Error al mostrar confirmación:', error);
        // Fallback: Redirigir al inicio si hay error
        setTimeout(goToHome, 1000);
    }
}

// Función para cerrar confirmación y volver al inicio
function closeConfirmationAndGoHome() {
    try {
        const modal = document.getElementById('order-confirmation-modal');
        if (!modal) {
            goToHome();
            return;
        }
        
        // Iniciar animación de salida
        modal.classList.remove('active');
        
        // Esperar a que termine la animación antes de ocultar
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            goToHome();
        }, 300);
        
    } catch (error) {
        console.error('Error al cerrar confirmación:', error);
        goToHome();
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
