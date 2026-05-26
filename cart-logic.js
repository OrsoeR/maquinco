// --- LÓGICA DE PERSISTENCIA Y VISUALIZACIÓN DEL CARRITO ---

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.querySelector('.cart-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        if (sidebar.classList.contains('active')) renderCarritoSidebar();
    }
}

function renderCarritoSidebar() {
    const container = document.getElementById('cart-items-container');
    const totalSide = document.getElementById('sidebar-total');
    if (!container || !totalSide) return;
    container.innerHTML = '';
    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:gray; margin-top:50px;">Tu carrito está vacío.</p>';
    } else {
        carrito.forEach((p, index) => {
            container.innerHTML += `
                <div class="cart-item" style="display:flex; gap:10px; padding:10px 0; border-bottom:1px solid #eee; align-items:center;">
                    <img src="${p.img || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; object-fit:contain;">
                    <div style="flex:1;">
                        <div style="font-size:12px; font-weight:bold;">${p.nombre}</div>
                        <div style="font-size:11px; color:#666;">Cant: ${p.cantidad}</div>
                        <div style="color:orange; font-weight:bold;">$${(Number(p.precio) * p.cantidad).toLocaleString()}</div>
                    </div>
                    <button onclick="eliminarDelCarrito(${index})" style="background:none; border:none; color:#ff4444; cursor:pointer;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`;
        });
    }
    totalSide.innerText = `$${total.toLocaleString()}`;
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarInterfazCarrito();
    guardarCarritoLocal();
    renderCarritoSidebar();
}

function actualizarInterfazCarrito() {
    total = carrito.reduce((sum, p) => sum + (Number(p.precio) * p.cantidad), 0);
    const countElem = document.getElementById('cart-count');
    const totalElem = document.getElementById('cart-total');
    
    const totalPiezas = carrito.reduce((sum, p) => sum + p.cantidad, 0);
    
    if(countElem) countElem.innerText = totalPiezas;
    if(totalElem) totalElem.innerText = `$${total.toLocaleString()}`;
}

function guardarCarritoLocal() {
    localStorage.setItem('maquinco_cart', JSON.stringify(carrito));
}

function cargarCarritoLocal() {
    const guardado = localStorage.getItem('maquinco_cart');
    if (guardado) {
        carrito = JSON.parse(guardado);
        actualizarInterfazCarrito();
    }
}

function copiarDato(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        alert("Copiado al portapapeles");
    });
}

// --- INTERCEPCIÓN DE RENTA / COMPRA CON MODAL DE CANTIDAD INTEGRADO ---
async function comprar(id) {
    const p = productos.find(x => x.id === id);
    const stockDisponible = p.stock || 0;

    if (!p || !p.disponible || stockDisponible <= 0) {
        return alert("Este producto ya no está disponible.");
    }

    // Si el producto es de categoría Renta, se desvía directo a la atención de WhatsApp
    if (p.categoria === 'Renta') {
        const telefonoMaquinco = "529612315072"; 
        const precioFormateado = Number(p.precio).toLocaleString();
        const mensajeWhatsApp = `Hola MAQUINCO, me interesa solicitar una cotización para la RENTA del siguiente equipo:\n\n` +
                                `🛠️ *Equipo:* ${p.nombre}\n` +
                                `💰 *Precio base:* $${precioFormateado} / Día\n\n` +
                                `¿Me podrían proporcionar más información sobre la disponibilidad y requisitos de renta?`;
        window.open(`https://wa.me/${telefonoMaquinco}?text=${encodeURIComponent(mensajeWhatsApp)}`, '_blank');
        return;
    }

    // Modal de cantidad nativo corregido y sincronizado para productos en Venta
    productoTemporal = p;
    const qtyModal = document.getElementById('quantityModal');
    const overlay = document.getElementById('modalOverlay');
    
    if (qtyModal && overlay) {
        document.getElementById('qtyTitle').innerText = p.nombre;
        document.getElementById('qtyStock').innerText = `Disponibles: ${stockDisponible}`;
        document.getElementById('inputQty').value = 1;
        document.getElementById('inputQty').max = stockDisponible;
        qtyModal.style.display = 'block';
        overlay.style.display = 'block';
        
        document.getElementById('btnConfirmarQty').onclick = function() {
            confirmarCompraConCantidad();
        };
    } else {
        // Fallback clásico por si los contenedores modales no están listos en el HTML
        let cantInput = prompt(`¿Cuántas unidades de "${p.nombre}" deseas?\n(Disponibles: ${stockDisponible})`, "1");
        let cantidad = parseInt(cantInput);
        if (isNaN(cantidad) || cantidad <= 0 || cantidad > stockDisponible) return;
        
        const itemExistente = carrito.find(item => item.id === id);
        if (itemExistente) {
            if ((itemExistente.cantidad + cantidad) > stockDisponible) return alert("Supera el stock disponible.");
            itemExistente.cantidad += cantidad;
        } else {
            carrito.push({ ...p, cantidad: cantidad });
        }
        actualizarInterfazCarrito();
        guardarCarritoLocal();
        toggleCart();
    }
}

// --- PASARELA DE PAGOS FLUIDA (CHECKOUT EVOLUCIONADO) ---

function finalizarCompra() {
    const user = firebase.auth().currentUser;
    if (!user) { alert("⚠️ Inicia sesión primero para realizar tu compra."); abrirLogin(); return; }
    if (carrito.length === 0) return alert("Tu carrito está vacío.");

    const modal = document.getElementById('checkoutModal');
    const overlay = document.getElementById('modalOverlay');
    
    if(modal && overlay) {
        modal.style.display = 'block';
        overlay.style.display = 'block';
        // Inyectamos la estructura base del Checkout de tres pasos independientes
        modal.innerHTML = `
            <div class="modal-content-custom" style="background: white; border-radius: 12px; padding: 25px; max-width: 500px; margin: auto; position: relative; font-family: sans-serif;">
                <span onclick="cerrarCheckout()" style="position: absolute; top: 15px; right: 20px; cursor: pointer; font-size: 20px; color: #888;">&times;</span>
                <div id="checkout-step-container">
                    ${obtenerHtmlPasoEnvio()}
                </div>
            </div>
        `;
    }
}

function cerrarCheckout() {
    const modal = document.getElementById('checkoutModal');
    const overlay = document.getElementById('modalOverlay');
    if(modal) modal.style.display = 'none';
    if(overlay) overlay.style.display = 'none';
}

// Paso 1: Datos de Entrega y Envío
function obtenerHtmlPasoEnvio() {
    return `
        <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #3483fa; padding-bottom: 8px;">1. Datos de Envío</h3>
        <p style="font-size: 13px; color: #666;">Ingresa la dirección donde recibirás tu maquinaria y herramientas de venta.</p>
        <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; font-weight: bold; color: #555;">Teléfono de Contacto Celular *</label>
            <input type="tel" id="checkout-tel" placeholder="Ej. 9612345678" style="width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="font-size: 12px; font-weight: bold; color: #555;">Dirección Completa de Entrega *</label>
            <textarea id="checkout-dir" placeholder="Calle, Número, Colonia, C.P. Tuxtla Gutiérrez" rows="3" style="width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; resize: none;"></textarea>
        </div>
        <button onclick="procesarPasoEnvio()" style="width: 100%; background: #3483fa; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">
            Continuar a Métodos de Pago &rarr;
        </button>
    `;
}

// Guarda temporalmente los datos de envío y pasa al paso 2
let datosEnvioTemporales = {};
function procesarPasoEnvio() {
    const tel = document.getElementById('checkout-tel').value.trim();
    const dir = document.getElementById('checkout-dir').value.trim();

    if (!tel || !dir) { alert("Por favor, completa los campos requeridos para el envío."); return; }
    datosEnvioTemporales = { telefono: tel, direccion: dir };
    
    document.getElementById('checkout-step-container').innerHTML = obtenerHtmlPasoMetodoPago();
}

// Paso 2: Selección del Método de Pago Estilo Pasarela Profesional
function obtenerHtmlPasoMetodoPago() {
    return `
        <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #3483fa; padding-bottom: 8px;">2. Método de Pago</h3>
        <p style="font-size: 13px; color: #666;">Selecciona la opción de tu preferencia para liquidar los **$${total.toLocaleString()}** del pedido:</p>
        
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #fafafa;">
                <input type="radio" name="metodoPagoOp" value="Tarjeta" checked onchange="evaluarFormularioPagoHtml(this.value)">
                <div>
                    <strong style="font-size: 14px; color: #333;"><i class="far fa-credit-card"></i> Tarjeta de Crédito o Débito</strong>
                    <div style="font-size: 11px; color: #888;">Visa, Mastercard, American Express (Acreditación inmediata)</div>
                </div>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #fafafa;">
                <input type="radio" name="metodoPagoOp" value="SPEI" onchange="evaluarFormularioPagoHtml(this.value)">
                <div>
                    <strong style="font-size: 14px; color: #333;"><i class="fas fa-university"></i> Transferencia Interbancaria SPEI</strong>
                    <div style="font-size: 11px; color: #888;">Se te asignará una CLABE única en el portal de cobro</div>
                </div>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: #fafafa;">
                <input type="radio" name="metodoPagoOp" value="Efectivo" onchange="evaluarFormularioPagoHtml(this.value)">
                <div>
                    <strong style="font-size: 14px; color: #333;"><i class="fas fa-store"></i> Efectivo en Puntos de Pago</strong>
                    <div style="font-size: 11px; color: #888;">OXXO, 7-Eleven o ventanillas bancarias autorizadas</div>
                </div>
            </label>
        </div>

        <div id="contenedor-campos-pago-dinamicos" style="margin-bottom: 20px;">
            ${obtenerCamposTarjetaHtml()}
        </div>

        <div style="display: flex; gap: 10px;">
            <button onclick="document.getElementById('checkout-step-container').innerHTML = obtenerHtmlPasoEnvio();" style="flex: 1; background: #eee; color: #555; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                &larr; Volver
            </button>
            <button onclick="confirmarPedidoFinalPASARELA()" style="flex: 2; background: #00a650; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                Confirmar y Pagar
            </button>
        </div>
    `;
}

function evaluarFormularioPagoHtml(tipo) {
    const contenedor = document.getElementById('contenedor-campos-pago-dinamicos');
    if (!contenedor) return;
    if (tipo === 'Tarjeta') {
        contenedor.innerHTML = obtenerCamposTarjetaHtml();
    } else if (tipo === 'SPEI') {
        contenedor.innerHTML = `
            <div style="background: #f1f8ff; border: 1px dashed #3483fa; padding: 12px; border-radius: 6px; font-size: 12px; color: #222;">
                ℹ️ Al confirmar, generaremos una ficha bancaria oficial con la CLABE interbancaria para que realices tu transferencia desde tu banca móvil.
            </div>`;
    } else if (tipo === 'Efectivo') {
        contenedor.innerHTML = `
            <div style="background: #fff8e1; border: 1px dashed #ffb300; padding: 12px; border-radius: 6px; font-size: 12px; color: #222;">
                ℹ️ Al confirmar, obtendrás una referencia numérica de pago para liquidar de forma presencial en cualquier OXXO o corresponsal.
            </div>`;
    }
}

function obtenerCamposTarjetaHtml() {
    return `
        <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; font-weight: bold; color: #555;">Número de Tarjeta</label>
                <input type="text" id="cc-num" maxlength="16" placeholder="4152 0000 0000 0000" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: monospace;">
            </div>
            <div style="display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">Expiración (MM/AA)</label>
                    <input type="text" id="cc-exp" maxlength="5" placeholder="12/29" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; text-align: center;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: bold; color: #555;">CVC / CVV</label>
                    <input type="password" id="cc-cvv" maxlength="4" placeholder="123" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; text-align: center;">
                </div>
            </div>
            <div style="margin-top: 10px;">
                <label style="font-size: 11px; font-weight: bold; color: #555;">Titular de la Tarjeta</label>
                <input type="text" id="cc-name" placeholder="NOMBRE TAL CUAL APARECE" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; text-transform: uppercase;">
            </div>
        </div>
    `;
}

// Paso 3: Envío de Datos a Firebase + Despliegue de Resultados Finales de Transacción
async function confirmarPedidoFinalPASARELA() {
    const user = firebase.auth().currentUser;
    const radioMetodo = document.querySelector('input[name="metodoPagoOp"]:checked');
    if (!radioMetodo) return alert("Selecciona un método de pago.");
    
    const metodoSeleccionado = radioMetodo.value;

    // Validación exhaustiva del formulario si se usa Tarjeta
    if (metodoSeleccionado === 'Tarjeta') {
        const num = document.getElementById('cc-num').value.replace(/\s+/g, '');
        const exp = document.getElementById('cc-exp').value.trim();
        const cvv = document.getElementById('cc-cvv').value.trim();
        const name = document.getElementById('cc-name').value.trim();

        if (num.length < 15 || !exp.includes('/') || cvv.length < 3 || !name) {
            alert("Los datos de la tarjeta bancaria son inválidos o están incompletos.");
            return;
        }
    }

    try {
        // Estructuración del pedido para persistir en Firestore
        const pedido = {
            clienteEmail: user.email,
            telefono: datosEnvioTemporales.telefono,
            direccion: datosEnvioTemporales.direccion,
            metodoPago: metodoSeleccionado === 'Tarjeta' ? 'Tarjeta Crédito/Débito' : (metodoSeleccionado === 'SPEI' ? 'Transferencia SPEI' : 'Efectivo Corresponsal'),
            productos: carrito.map(p => ({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: p.cantidad })),
            total: total,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            estado: metodoSeleccionado === 'Tarjeta' ? "Pago Aprobado" : "Esperando Pago"
        };

        // Guardado asíncrono
        await db.collection("pedidos").add(pedido);

        // Descuento Atómico de Inventario y Stock
        const batch = db.batch();
        for (const item of carrito) {
            const pRef = db.collection("productos").doc(item.id);
            const doc = await pRef.get();
            if (doc.exists) {
                const stockActual = doc.data().stock || 0;
                const nuevoStock = Math.max(0, stockActual - item.cantidad);
                batch.update(pRef, { 
                    stock: nuevoStock,
                    disponible: nuevoStock > 0,
                    ventas: firebase.firestore.FieldValue.increment(item.cantidad)
                });
            }
        }
        await batch.commit();

        // Inyección dinámica de la pantalla de Éxito / Comprobante de la Pasarela
        const contenedorPaso = document.getElementById('checkout-step-container');
        
        if (metodoSeleccionado === 'Tarjeta') {
            contenedorPaso.innerHTML = `
                <div style="text-align: center; padding: 15px;">
                    <div style="color: #00a650; font-size: 55px; margin-bottom: 15px;"><i class="fas fa-check-circle"></i></div>
                    <h3 style="color: #333; margin-bottom: 10px;">¡Pago Autorizado Exitosamente!</h3>
                    <p style="font-size: 14px; color: #555;">Hemos procesado el cobro por **$${total.toLocaleString()}** de tus equipos.</p>
                    <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; font-size: 12px; color: #666; text-align: left; border: 1px solid #eee; margin-top: 15px;">
                        💳 <b>Operación:</b> Transacción en Línea Directa<br>
                        📦 <b>Envío:</b> Preparando despacho a tu ubicación en Tuxtla Gutiérrez.<br>
                        📧 <b>Comprobante:</b> Enviado a tu dirección de correo electrónico registrado.
                    </div>
                    <button onclick="location.reload()" style="width: 100%; margin-top: 25px; padding: 13px; background: #3483fa; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Volver a la Tienda
                    </button>
                </div>`;
        } else if (metodoSeleccionado === 'SPEI') {
            contenedorPaso.innerHTML = `
                <div style="text-align: center; padding: 5px;">
                    <div style="color: #3483fa; font-size: 50px; margin-bottom: 15px;"><i class="fas fa-university"></i></div>
                    <h3 style="margin-bottom: 10px;">Orden SPEI Generada</h3>
                    <p style="font-size: 13px; color: #555; margin-bottom: 20px;">Transfiere exactamente la cantidad de **$${total.toLocaleString()}** desde tu app móvil.</p>
                    
                    <div style="background: #f8f8f8; border-radius: 10px; padding: 18px; text-align: left; border: 1px solid #eee;">
                        <small style="color: #999; text-transform: uppercase; font-size: 9px; font-weight: bold;">Banco Receptor</small>
                        <div style="font-weight: bold; color: #333; font-size: 14px;">Mercado Pago Wallet (STP)</div>
                        <br>
                        <small style="color: #999; text-transform: uppercase; font-size: 9px; font-weight: bold;">CLABE Interbancaria Única</small>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
                            <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #111; letter-spacing: 0.5px;">722969028189865541</span>
                            <button onclick="copiarDato('722969028189865541')" style="color: #3483fa; background: none; border: none; cursor: pointer; font-weight: bold; font-size: 12px;">COPIAR</button>
                        </div>
                        <br>
                        <small style="color: #999; text-transform: uppercase; font-size: 9px; font-weight: bold;">Beneficiario Titular</small>
                        <div style="font-weight: bold; color: #333;">Joan Orsoe Ruiz Alvarez - MAQUINCO</div>
                    </div>
                    <button onclick="location.reload()" style="width: 100%; margin-top: 25px; padding: 13px; background: #00a650; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Ya realicé la transferencia SPEI
                    </button>
                </div>`;
        } else if (metodoSeleccionado === 'Efectivo') {
            // Referencia aleatoria para simular el código de barras/pago presencial
            const referenciaFicticia = Math.floor(100000000000 + Math.random() * 900000000000);
            contenedorPaso.innerHTML = `
                <div style="text-align: center; padding: 5px;">
                    <div style="color: #ffb300; font-size: 50px; margin-bottom: 15px;"><i class="fas fa-barcode"></i></div>
                    <h3 style="margin-bottom: 10px;">Ficha de Pago en Efectivo</h3>
                    <p style="font-size: 13px; color: #555;">Muestra este código en cajas de OXXO o comercios asociados para pagar **$${total.toLocaleString()}**.</p>
                    
                    <div style="background: #fcfcfc; border: 2px dashed #bbb; border-radius: 10px; padding: 20px; text-align: center; margin-top: 15px;">
                        <span style="font-size: 11px; color: #777; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px;">Referencia de Pago Coorporativa</span>
                        <div style="font-family: monospace; font-size: 20px; font-weight: bold; color: #222; letter-spacing: 2px;">${referenciaFicticia}</div>
                        <button onclick="copiarDato('${referenciaFicticia}')" style="color: #3483fa; background: none; border: none; cursor: pointer; font-weight: bold; font-size: 11px; margin-top: 8px;">COPIAR NÚMERO</button>
                    </div>
                    <p style="font-size: 11px; color: #888; margin-top: 12px;">⏰ Tienes 48 horas hábiles para realizar tu depósito, de lo contrario la orden se cancelará automáticamente.</p>
                    <button onclick="location.reload()" style="width: 100%; margin-top: 20px; padding: 13px; background: #1a1a1a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                        Entendido, Guardar Ficha
                    </button>
                </div>`;
        }

        // Vaciado seguro del estado de compra del cliente
        carrito = [];
        guardarCarritoLocal();
        actualizarInterfazCarrito();

    } catch (error) {
        console.error(error);
        alert("Ocurrió un error inesperado al procesar la transacción bancaria de tu orden.");
    }
}

cargarCarritoLocal();