/**
 * Sistema de Autocompletado para Payment Section
 * Guarda y recupera datos de full-name, email y phone desde localStorage
 */

class PaymentAutofill {
    constructor() {
        this.storageKey = 'buquenque_payment_data';
        this.fields = {
            fullName: 'full-name',
            email: 'email',
            phone: 'phone',
            locationConfirm: 'location-confirm'
        };
    }

    /**
     * Obtiene los datos guardados en localStorage
     */
    getSavedData() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Error al obtener datos guardados:', error);
            return null;
        }
    }

    /**
     * Guarda los datos en localStorage
     */
    saveData(fullName, email, phone, locationConfirm = false) {
        try {
            const data = {
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                locationConfirm: Boolean(locationConfirm),
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error al guardar datos:', error);
        }
    }

    /**
     * Carga los datos guardados en los inputs
     */
    autofillFields() {
        const savedData = this.getSavedData();
        
        if (savedData) {
            const fullNameInput = document.getElementById(this.fields.fullName);
            const emailInput = document.getElementById(this.fields.email);
            const phoneInput = document.getElementById(this.fields.phone);

            if (fullNameInput && savedData.fullName) {
                fullNameInput.value = savedData.fullName;
            }
            
            if (emailInput && savedData.email) {
                emailInput.value = savedData.email;
            }
            
            if (phoneInput && savedData.phone) {
                phoneInput.value = savedData.phone;
            }

            const locationConfirmInput = document.getElementById(this.fields.locationConfirm);
            if (locationConfirmInput) {
                locationConfirmInput.checked = Boolean(savedData.locationConfirm);
            }

            console.log('Campos completados automáticamente');
        }
    }

    /**
     * Agrega event listeners a los inputs para guardar en tiempo real
     */
    attachInputListeners() {
        const fullNameInput = document.getElementById(this.fields.fullName);
        const emailInput = document.getElementById(this.fields.email);
        const phoneInput = document.getElementById(this.fields.phone);
        const locationConfirmInput = document.getElementById(this.fields.locationConfirm);

        const handleInputChange = () => {
            this.updateStorage();
        };

        if (fullNameInput) {
            fullNameInput.addEventListener('change', handleInputChange);
            fullNameInput.addEventListener('blur', handleInputChange);
        }

        if (emailInput) {
            emailInput.addEventListener('change', handleInputChange);
            emailInput.addEventListener('blur', handleInputChange);
        }

        if (phoneInput) {
            phoneInput.addEventListener('change', handleInputChange);
            phoneInput.addEventListener('blur', handleInputChange);
        }

        if (locationConfirmInput) {
            locationConfirmInput.addEventListener('change', handleInputChange);
            locationConfirmInput.addEventListener('click', handleInputChange);
        }
    }

    /**
     * Actualiza los datos en localStorage desde los inputs actuales
     */
    updateStorage() {
        const fullNameInput = document.getElementById(this.fields.fullName);
        const emailInput = document.getElementById(this.fields.email);
        const phoneInput = document.getElementById(this.fields.phone);
        const locationConfirmInput = document.getElementById(this.fields.locationConfirm);

        const fullName = fullNameInput?.value || '';
        const email = emailInput?.value || '';
        const phone = phoneInput?.value || '';
        const locationConfirm = locationConfirmInput?.checked || false;

        if (fullName || email || phone || locationConfirmInput) {
            this.saveData(fullName, email, phone, locationConfirm);
        }
    }

    /**
     * Inicializa el sistema de autocompletado
     * Se debe llamar cuando se muestre el payment-section
     */
    initialize() {
        this.autofillFields();
        this.attachInputListeners();
    }

    /**
     * Limpia los datos guardados
     */
    clearSavedData() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('Datos de pago eliminados del localStorage');
        } catch (error) {
            console.error('Error al eliminar datos:', error);
        }
    }
}

// Crear instancia global
const paymentAutofill = new PaymentAutofill();

/**
 * Hook para inicializar cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', () => {
    // El inicializador real se llamará desde showPaymentSection()
    // Este evento solo asegura que la clase esté disponible
});
