/**
 * Sistema Independiente de Mensajes Importantes (mensaje.json)
 * ¡COMPLETAMENTE SEPARADO del sistema de notificaciones estándar!
 * 
 * Storage key: buquenque_important_message_seen
 * Container ID: important-message-banner-container
 * 
 * Características:
 * - Carga mensajes desde mensaje.json
 * - Valida rango de fechas (inicio - fin)
 * - Almacena visualización en localStorage como el ID del mensaje actual
 * - Deshabilita checkout si está dentro del rango de fechas
 * - Completamente independiente del NotificationManager existente
 */

class MessageNotificationSystem {
    constructor() {
        // Almacenar solo un ID actual. Si cambia, se mostrará de nuevo.
        this.storageKey = 'buquenque_important_message_seen';
        this.containerID = 'important-message-banner-container';
        this.messageContainer = null;
        this.messageData = null;
        this.checkoutBtn = null;
        this.isWithinDateRange = false;
        this.autoCloseTimeout = null;
        
        // DEBUG
        this.debugMode = true;
    }

    /**
     * Log para debugging
     */
    log(message, data = null) {
        if (this.debugMode) {
            console.log(`[MessageNotificationSystem] ${message}`, data || '');
        }
    }

    /**
     * Inicializa el sistema de mensajes
     */
    async init() {
        this.log('✅ Iniciando sistema de mensajes importantes...');
        try {
            // Crear el contenedor si no existe
            this.createMessageContainer();

            // Cargar datos del JSON
            await this.loadMessageData();

            // Si hay datos válidos, procesar
            if (this.messageData) {
                // Validar estructura
                if (!this.validateMessageData()) {
                    return;
                }

                // Convertir fechas a objetos Date
                this.convertDatesToObjects();

                // Verificar rango de fechas
                this.checkDateRange();

                // Mostrar el mensaje siempre si está activo.
                this.checkAndShowMessage();

                // Bloquear checkout solo dentro del intervalo de fechas
                if (this.isWithinDateRange) {
                    this.disableCheckout();
                } else {
                    this.enableCheckout();
                }
            } else {
                this.log('⚠️ No hay datos de mensaje para procesar');
            }
        } catch (error) {
            console.error('[MessageNotificationSystem] Error inicializando:', error);
        }
    }

    /**
     * Carga los datos del mensaje desde mensaje.json
     */
    async loadMessageData() {
        try {
            const response = await fetch('Json/mensaje.json');
            if (!response.ok) {
                throw new Error(`Error cargando mensaje.json: ${response.status}`);
            }
            const data = await response.json();
            
            // El JSON es un array, tomar el primer elemento
            if (Array.isArray(data) && data.length > 0) {
                this.messageData = data[0];
            } else if (!Array.isArray(data)) {
                this.messageData = data;
            }
            
            this.log('📄 Datos de JSON cargados:', this.messageData);
        } catch (error) {
            console.error('[MessageNotificationSystem] Error cargando mensaje.json:', error);
            this.messageData = null;
        }
    }

    /**
     * Valida que el mensaje tenga los campos requeridos
     */
    validateMessageData() {
        if (!this.messageData) return false;

        const requiredFields = ['id', 'mensaje', 'activo', 'inicio', 'fin'];
        const hasAllFields = requiredFields.every(field => this.messageData.hasOwnProperty(field));

        if (!hasAllFields) {
            console.error('[MessageNotificationSystem] Mensaje incompleto. Campos requeridos:', requiredFields);
            this.log('❌ Campos faltantes:', requiredFields);
            return false;
        }

        // Validar que activo sea boolean
        if (typeof this.messageData.activo !== 'boolean') {
            console.error('Campo "activo" debe ser booleano');
            return false;
        }

        return true;
    }

    /**
     * Convierte strings de fecha ISO a objetos Date
     */
    convertDatesToObjects() {
        try {
            this.messageData.inicioDate = new Date(this.messageData.inicio);
            this.messageData.finDate = new Date(this.messageData.fin);

            this.log('📅 Fechas convertidas:', {
                inicio_string: this.messageData.inicio,
                inicio_date: this.messageData.inicioDate,
                fin_string: this.messageData.fin,
                fin_date: this.messageData.finDate
            });

            // Validar que las fechas sean válidas
            if (isNaN(this.messageData.inicioDate.getTime()) || isNaN(this.messageData.finDate.getTime())) {
                throw new Error('Formato de fecha inválido');
            }
        } catch (error) {
            console.error('[MessageNotificationSystem] Error al convertir fechas:', error);
            this.log('❌ Error en conversión de fechas:', error);
            this.messageData = null;
        }
    }

    /**
     * Verifica si la fecha actual está dentro del rango
     */
    checkDateRange() {
        if (!this.messageData || !this.messageData.inicioDate || !this.messageData.finDate) {
            this.isWithinDateRange = false;
            this.log('❌ No se puede verificar rango: datos de fecha faltantes');
            return;
        }

        const now = new Date();
        this.isWithinDateRange = 
            now >= this.messageData.inicioDate && 
            now <= this.messageData.finDate;

        this.log('⏰ Comparación de fechas:', {
            fecha_actual: now,
            fecha_inicio: this.messageData.inicioDate,
            fecha_fin: this.messageData.finDate,
            esta_dentro_rango: this.isWithinDateRange
        });
    }

    /**
     * Crea el contenedor para el mensaje si no existe
     */
    createMessageContainer() {
        // Usar ID completamente diferente: important-message-banner-container
        if (!document.getElementById(this.containerID)) {
            const container = document.createElement('div');
            container.id = this.containerID;
            container.className = 'message-notification-banner hidden';
            document.body.insertBefore(container, document.body.firstChild);
            this.messageContainer = container;
            this.log('✅ Nuevo contenedor creado con ID:', this.containerID);
        } else {
            this.messageContainer = document.getElementById(this.containerID);
            this.log('✅ Contenedor existente encontrado:', this.containerID);
        }
    }

    /**
     * Obtiene la clave de almacenamiento única
     */
    getStorageKey() {
        this.log('📦 Clave de almacenamiento única:', this.storageKey);
        return this.storageKey;
    }

    /**
     * Verifica si el usuario ya vio este mensaje actual
     */
    hasUserSeenMessage() {
        const key = this.getStorageKey();
        const storedId = localStorage.getItem(key);
        const hasSeen = storedId === String(this.messageData.id);
        this.log('👁️ ¿Usuario vio el mensaje actual?', { key, storedId, currentId: this.messageData.id, hasSeen });
        return hasSeen;
    }

    /**
     * Marca el mensaje actual como visto guardando solo su ID
     */
    markMessageAsSeen() {
        const key = this.getStorageKey();
        const idValue = String(this.messageData.id);
        localStorage.setItem(key, idValue);
        this.log('✅ Mensaje marcado como visto en localStorage:', { key, idValue });
    }

    /**
     * Verifica si debe mostrar el mensaje
     */
    checkAndShowMessage() {
        if (!this.messageData || !this.messageData.activo) {
            this.log('⏭️ Mensaje no está activo, no mostrando');
            return;
        }

        // Mostrar si el usuario NO lo ha visto antes
        if (!this.hasUserSeenMessage()) {
            this.log('🎯 El usuario NO ha visto este mensaje - MOSTRANDO');
            this.showMessage();
        } else {
            this.log('⏭️ El usuario ya vio este mensaje - NO mostrando');
        }
    }

    /**
     * Muestra el panel de mensaje
     */
    showMessage() {
        if (!this.messageContainer || !this.messageData) {
            this.log('❌ No se puede mostrar: contenedor o datos faltantes');
            return;
        }

        const titulo = this.messageData.titulo || 'Aviso Importante';
        const mensaje = this.messageData.mensaje;
        const icono = this.messageData.icono || 'fas fa-exclamation-triangle';

        this.log('🎨 Renderizando mensaje en el DOM...');

        // Crear el contenido del panel de mensaje
        this.messageContainer.innerHTML = `
            <div class="message-notification-wrapper">
                <div class="message-notification-background"></div>
                <div class="message-notification-content">
                    <div class="message-notification-main">
                        <div class="message-notification-icon-wrapper">
                            <div class="message-notification-icon warning">
                                <i class="${this.escapeHtml(icono)}"></i>
                            </div>
                            <div class="message-notification-glow"></div>
                        </div>
                        <div class="message-notification-text">
                            <h3 class="message-notification-title">${this.escapeHtml(titulo)}</h3>
                            <p class="message-notification-message">${this.escapeHtml(mensaje)}</p>
                        </div>
                    </div>
                    <div class="message-notification-actions">
                        <button class="message-notification-btn-close" onclick="messageNotificationSystem.closeMessage()" title="Cerrar aviso">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="message-notification-progress"></div>
            </div>
        `;

        this.log('✅ HTML insertado en el contenedor');

        // Mostrar el panel
        this.messageContainer.classList.remove('hidden');
        this.messageContainer.classList.add('visible');

        this.log('✅ Clases CSS aplicadas: visible');

        // Hacer scroll al top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        this.log('✅ Scroll al top ejecutado');

        // Auto-cerrar después de 15 segundos (opcional)
        this.startAutoClose();
    }

    /**
     * Inicia el cierre automático del mensaje
     */
    startAutoClose() {
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
        }
        this.autoCloseTimeout = setTimeout(() => {
            this.log('⏱️ Auto-cerrando mensaje (15 segundos)');
            this.closeMessage();
        }, 15000);
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
     * Cierra el mensaje y marca como visto
     */
    closeMessage() {
        this.log('🔒 Cerrando mensaje...');
        if (this.messageContainer) {
            this.messageContainer.classList.remove('visible');
            this.messageContainer.classList.add('hidden');

            // Marcar como visto
            this.markMessageAsSeen();

            // Remover del DOM después de la animación
            setTimeout(() => {
                this.messageContainer.innerHTML = '';
                this.log('✅ Mensaje removido del DOM');
            }, 300);
        }
        this.cancelAutoClose();
    }

    /**
     * Obtiene referencia al botón de checkout
     */
    getCheckoutButton() {
        if (!this.checkoutBtn) {
            this.checkoutBtn = document.querySelector('.checkout-btn');
            this.log('🔍 Buscando botón checkout:', this.checkoutBtn ? '✅ Encontrado' : '❌ No encontrado');
        }
        return this.checkoutBtn;
    }

    /**
     * Deshabilita el botón de checkout y muestra mensaje
     */
    disableCheckout() {
        const btn = this.getCheckoutButton();
        if (btn) {
            this.log('🔒 Deshabilitando botón checkout...');
            btn.disabled = true;
            btn.classList.add('checkout-disabled');
            btn.title = 'No se puede finalizar el pedido: ' + this.messageData.mensaje;

            // Agregar listener para mostrar tooltip/advertencia
            if (!btn.dataset.messageWarningAdded) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showCheckoutBlockedWarning();
                });
                btn.dataset.messageWarningAdded = 'true';
                this.log('✅ Event listener agregado al botón');
            }
        } else {
            this.log('⚠️ Botón checkout no encontrado - reintentando en 1 segundo');
            // Reintentar en 1 segundo si el botón no existe aún
            setTimeout(() => this.disableCheckout(), 1000);
        }
    }

    /**
     * Habilita el botón de checkout
     */
    enableCheckout() {
        const btn = this.getCheckoutButton();
        if (btn) {
            this.log('🔓 Habilitando botón checkout');
            btn.disabled = false;
            btn.classList.remove('checkout-disabled');
            btn.title = '';
        }
    }

    /**
     * Muestra una advertencia si el usuario intenta hacer checkout mientras está bloqueado
     */
    showCheckoutBlockedWarning() {
        this.log('⚠️ Usuario intentó hacer click en checkout bloqueado');
        // Crear y mostrar un alert o toast
        alert('⚠️ ' + this.messageData.mensaje + '\n\nNo se puede finalizar el pedido en este momento.');
    }

    /**
     * Escapa caracteres HTML para evitar inyecciones
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Obtiene información de depuración del sistema
     */
    getDebugInfo() {
        const debug = {
            mensaje: this.messageData,
            isWithinDateRange: this.isWithinDateRange,
            hasUserSeenMessage: this.messageData ? this.hasUserSeenMessage() : null,
            storageKey: this.messageData ? this.getStorageKey() : null,
            containerID: this.containerID,
            containerExists: this.messageContainer ? true : false,
            currentDate: new Date(),
            fechaInicio: this.messageData ? this.messageData.inicioDate : null,
            fechaFin: this.messageData ? this.messageData.finDate : null
        };
        console.table(debug);
        return debug;
    }

    /**
     * Limpiar localStorage viejo (para migración)
     */
    cleanOldStorage() {
        // Limpiar claves antiguas si existen
        const legacyKeys = [
            'buquenque_message_seen_1',
            'buquenque_message_seen_2',
            'buquenque_notification_seen'
        ];
        legacyKeys.forEach(oldKey => {
            if (localStorage.getItem(oldKey)) {
                this.log('🧹 Limpiando localStorage viejo:', oldKey);
                localStorage.removeItem(oldKey);
            }
        });

        // Limpiar claves legacy creadas por versiones previas que usaban sufijo de ID
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('buquenque_important_message_seen_')) {
                this.log('🧹 Eliminando clave legacy de localStorage:', key);
                localStorage.removeItem(key);
                i--; // ajustar índice después de eliminación
            }
        }
    }
}

// Crear instancia global del sistema de mensajes
let messageNotificationSystem = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 [MessageNotificationSystem] DOMContentLoaded disparado - Inicializando...');
    
    // Pequeña pausa para asegurar que otros scripts hayan terminado su inicialización
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('✅ [MessageNotificationSystem] Tiempo de espera completado - Creando instancia...');
    messageNotificationSystem = new MessageNotificationSystem();
    
    console.log('🔄 [MessageNotificationSystem] Limpiando almacenamiento antiguo...');
    messageNotificationSystem.cleanOldStorage();
    
    console.log('📋 [MessageNotificationSystem] Iniciando sistema...');
    await messageNotificationSystem.init();
    
    console.log('✅ [MessageNotificationSystem] Sistema completamente inicializado');
    console.log('💡 Tip: Ejecuta messageNotificationSystem.getDebugInfo() para ver detalles');
});
