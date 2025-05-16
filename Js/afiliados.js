// Función para obtener el parámetro 'ref' de la URL
function getRefParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref')?.trim(); // Eliminando espacios en blanco
}

// Función para verificar si el afiliado existe en el JSON
async function verifyAffiliate(ref) {
    try {
        const response = await fetch('Json/afiliados.json');
        if (!response.ok) throw new Error('Error al cargar afiliados');

        const data = await response.json();
        return data.afiliados.find(affiliate => affiliate.id.toLowerCase() === ref.toLowerCase()) || null;
    } catch (error) {
        console.error('Error al verificar afiliado:', error);
        return null;
    }
}

// Función para limpiar el parámetro 'ref' de la URL
function cleanRefParameter() {
    const url = new URL(window.location);
    url.searchParams.delete('ref');
    window.history.replaceState(null, '', url.href);
}

// Función principal para manejar la lógica de afiliados
async function handleAffiliate() {
    const ref = getRefParameter();

    let affiliate = null;

    if (ref) {
        affiliate = await verifyAffiliate(ref);
        if (affiliate) {
            localStorage.setItem('affiliateRef', affiliate.id);
            localStorage.setItem('affiliateName', affiliate.nombre);
            cleanRefParameter();
        }
    } else {
        const storedRef = localStorage.getItem('affiliateRef');
        const storedName = localStorage.getItem('affiliateName');
        if (storedRef && storedName) {
            affiliate = { id: storedRef, nombre: storedName };
        }
    }

    return affiliate;
}



// Función para obtener el afiliado actual (para usar en el formulario de pago)
function getCurrentAffiliate() {
    const storedRef = localStorage.getItem('affiliateRef');
    const storedName = localStorage.getItem('affiliateName');
    
    return storedRef ? { id: storedRef, nombre: storedName } : null;
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', handleAffiliate);
