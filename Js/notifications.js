/**
 * Sistema de Notificaciones Dinámicas
 * Carga notificaciones desde data.json y las gestiona con localStorage
 */

// Clase para gestionar notificaciones
class NotificationManager {
    constructor() {
        this.storageKey = 'buquenque_notification_id';
        this.notificationContainer = null;
        this.data = null;
        this.autoCloseTimeout = null;
    }

    /**
     * Inicializa el sistema de notificaciones
     */
    async init() {
        try {
            // Crear el contenedor si no existe
            this.createNotificationContainer();
            
            // Cargar datos del JSON
            await this.loadNotificationData();
            
            // Verificar si debe mostrar la notificación
            this.checkAndShowNotification();
        } catch (error) {
            console.error('Error inicializando notificaciones:', error);
        }
    }

    /**
     * Carga los datos de la notificación desde data.json
     */
    async loadNotificationData() {
        try {
            const response = await fetch('Json/data.json');
            if (!response.ok) {
                throw new Error(`Error cargando data.json: ${response.status}`);
            }
            this.data = await response.json();
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.data = null;
        }
    }

    /**
     * Crea el contenedor para las notificaciones
     */
    createNotificationContainer() {
        if (!document.getElementById('notification-banner')) {
            const container = document.createElement('div');
            container.id = 'notification-banner';
            container.className = 'notification-banner hidden';
            document.body.insertBefore(container, document.body.firstChild);
            this.notificationContainer = container;
        } else {
            this.notificationContainer = document.getElementById('notification-banner');
        }
    }

    /**
     * Verifica si debe mostrar la notificación
     */
    checkAndShowNotification() {
        if (!this.data || !this.data.id) {
            return;
        }

        const storedId = this.getStoredNotificationId();
        
        // Mostrar si el ID es diferente o no existe almacenado
        if (storedId !== this.data.id.toString()) {
            this.showNotification();
        }
    }

    /**
     * Obtiene el ID almacenado en localStorage
     */
    getStoredNotificationId() {
        return localStorage.getItem(this.storageKey);
    }

    /**
     * Guarda el ID en localStorage
     */
    saveNotificationId() {
        if (this.data && this.data.id) {
            localStorage.setItem(this.storageKey, this.data.id.toString());
        }
    }

    /**
     * Muestra la notificación en el banner
     */
    showNotification() {
        if (!this.notificationContainer || !this.data) {
            return;
        }

        const titulo = this.data.titulo || 'Notificación Importante';
        const mensaje = this.data.mensaje || '';
        const icono = this.data.icono || 'fas fa-bell';
        const tipo = this.data.tipo || 'info';

        // Crear el contenido del banner mejorado
        this.notificationContainer.innerHTML = `
            <div class="notification-wrapper">
                <div class="notification-background"></div>
                <div class="notification-content">
                    <div class="notification-main">
                        <div class="notification-icon-wrapper">
                            <div class="notification-icon ${tipo}">
                                <i class="${this.escapeHtml(icono)}"></i>
                            </div>
                            <div class="notification-glow"></div>
                        </div>
                        <div class="notification-text">
                            <h3 class="notification-title">${this.escapeHtml(titulo)}</h3>
                            <p class="notification-message">${this.escapeHtml(mensaje)}</p>
                            ${this.data.subtitulo ? `<p class="notification-subtitle">${this.escapeHtml(this.data.subtitulo)}</p>` : ''}
                        </div>
                    </div>
                    <div class="notification-actions">
                        <button class="notification-btn-accept" onclick="notificationManager.acceptNotification()">
                            <span class="btn-text">Entendido</span>
                            <span class="btn-icon"><i class="fas fa-check"></i></span>
                        </button>
                        <button class="notification-btn-close" onclick="notificationManager.closeNotification()" title="Cerrar notificación">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="notification-progress"></div>
            </div>
        `;

        // Mostrar el banner
        this.notificationContainer.classList.remove('hidden');
        this.notificationContainer.classList.add('visible');

        // Hacer scroll al top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Auto-cerrar después de 8 segundos (opcional)
        this.startAutoClose();
    }

    /**
     * Inicia el cierre automático de la notificación
     */
    startAutoClose() {
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
        }
        this.autoCloseTimeout = setTimeout(() => {
            this.acceptNotification();
        }, 20000);
    }

    /**
     * Cancela el cierre automático
     */
    cancelAutoClose() {
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
        }
    }

    /**
     * Acepta la notificación y la cierra
     */
    acceptNotification() {
        this.saveNotificationId();
        this.closeNotification();
    }

    /**
     * Cierra la notificación
     */
    closeNotification() {
        if (this.notificationContainer) {
            this.notificationContainer.classList.remove('visible');
            this.notificationContainer.classList.add('hidden');
            
            // Remover del DOM después de la animación
            setTimeout(() => {
                this.notificationContainer.innerHTML = '';
            }, 300);
        }
    }

    /**
     * Escapa caracteres HTML para evitar inyecciones
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Crear instancia global del gestor de notificaciones
let notificationManager = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManager();
    notificationManager.init();
});
