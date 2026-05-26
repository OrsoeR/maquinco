const firebaseConfig = {
    apiKey: "AIzaSyBanZAYwUBluom6wJ3ywQ5DT1144Ri_Z_w",
    authDomain: "maquinco-tuxtla.firebaseapp.com",
    projectId: "maquinco-tuxtla",
    storageBucket: "maquinco-tuxtla.appspot.com",
    messagingSenderId: "324439294195",
    appId: "1:324439294195:web:9e150a9e3e8c170c3c3786"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let productos = [];
let carrito = JSON.parse(localStorage.getItem('maquinco_cart')) || [];
let total = 0;
let editandoID = null;
let productoTemporal = null; // Variable para el Modal de Cantidad

// --- AUTH ---
async function registroReal() {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPass').value;
    const msg = document.getElementById('authMsg');
    try {
        const res = await auth.createUserWithEmailAndPassword(email, pass);
        await res.user.sendEmailVerification();
        await db.collection("usuarios").doc(res.user.uid).set({
            correo: email,
            verificado: false,
            empresa: "MAQUINCO",
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
        msg.style.color = "green"; msg.innerText = "Verifica tu correo.";
        await auth.signOut();
    } catch (e) { msg.innerText = "Error en registro."; }
}

async function loginReal() {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPass').value;
    const msg = document.getElementById('authMsg');
    try {
        const res = await auth.signInWithEmailAndPassword(email, pass);
        if (!res.user.emailVerified) { msg.innerText = "Verifica tu correo."; await auth.signOut(); return; }
        cerrarLogin(); location.reload();
    } catch (e) { msg.innerText = "Error de acceso."; }
}

async function loginConGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        await db.collection("usuarios").doc(result.user.uid).set({
            correo: result.user.email,
            verificado: true,
            empresa: "MAQUINCO",
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        cerrarLogin(); location.reload();
    } catch (e) { console.error(e); }
}

function cerrarSesion() { auth.signOut().then(() => location.reload()); }

auth.onAuthStateChanged((user) => {
    const statusText = document.getElementById('userNameStatus');
    const btnLogout = document.getElementById('btnCerrarSesion');
    const authInputs = document.getElementById('authInputs');
    if (user && user.emailVerified) {
        statusText.innerText = user.email.split('@')[0].toUpperCase();
        if(btnLogout) btnLogout.style.display = "block";
        if(authInputs) authInputs.style.display = "none";
    }
});

// --- ADMIN CONTROL (MODAL PERSONALIZADO REEMPLAZANDO PROMPT) ---
function abrirAdmin() {
    const adminModal = document.getElementById('adminAuthModal');
    const overlay = document.getElementById('modalOverlay');
    
    if (adminModal && overlay) {
        adminModal.style.display = 'block';
        overlay.style.display = 'block';
    }
    
    const passInput = document.getElementById('adminPassInput');
    const errorMsg = document.getElementById('adminAuthError');
    if (passInput) { passInput.value = ''; passInput.focus(); }
    if (errorMsg) errorMsg.style.display = 'none';
}

function cerrarAuthAdminModal() {
    const adminModal = document.getElementById('adminAuthModal');
    const overlay = document.getElementById('modalOverlay');
    if (adminModal) adminModal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

function verificarClaveAdmin() {
    const contraIngresada = document.getElementById('adminPassInput').value;
    const errorMsg = document.getElementById('adminAuthError');

    if (contraIngresada === "admin123") {
        cerrarAuthAdminModal();
        
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('nosotros').style.display = 'none';
        document.getElementById('renta').style.display = 'none';
        document.getElementById('contacto').style.display = 'none';
        document.getElementById('tiendaTitle').innerText = "GESTIÓN DE INVENTARIO - MAQUINCO";
        
        cargarDatosAdmin(); 
        buscarProducto();
        escucharPedidosAdmin(); 
    } else {
        if (errorMsg) errorMsg.style.display = 'block';
        document.getElementById('adminPassInput').value = '';
    }
}

function cerrarAdmin() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('nosotros').style.display = 'block';
    document.getElementById('renta').style.display = 'block';
    document.getElementById('contacto').style.display = 'block';
    document.getElementById('tiendaTitle').innerText = "PRODUCTOS EN VENTA";
    buscarProducto();
    window.scrollTo(0,0);
}

document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('adminPassInput');
    if (passInput) {
        passInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                verificarClaveAdmin();
            }
        });
    }
});

// --- PRODUCTOS ---
async function cargarDatosAdmin() {
    const container = document.getElementById('statsAdminContainer');
    if(!container) return;
    const top = [...productos].sort((a,b) => (b.ventas||0)-(a.ventas||0))[0];
    const userSnap = await db.collection("usuarios").orderBy("fechaRegistro", "desc").limit(5).get();
    let userHtml = `<div style="background:#e2e3e5; padding:15px; border-radius:5px;"><b>ÚLTIMOS CLIENTES:</b><ul style="font-size:12px;">`;
    userSnap.forEach(doc => { userHtml += `<li>${doc.data().correo}</li>`; });
    userHtml += `</ul></div>`;
    
    container.innerHTML = (top ? `<div style="background:#fff3cd; padding:15px; margin-bottom:10px; border-radius:5px;">🔥 <b>TOP VENTAS MAQUINCO:</b> ${top.nombre}</div>` : '') + 
                          `<div id="topClienteContainer"></div>` + 
                          userHtml;
}

async function agregarOActualizarProducto() {
    const nombre = document.getElementById('newProdNombre').value;
    const precio = parseFloat(document.getElementById('newProdPrecio').value);
    const cat = document.getElementById('newProdCat').value;
    const img = document.getElementById('newProdImg').value;
    const stock = parseInt(document.getElementById('newProdStock').value) || 0;

    if (!nombre || !precio || !cat) return alert("Completa los campos");
   
    const datos = {
        nombre,
        precio,
        categoria: cat,
        img,
        stock: stock,
        disponible: stock > 0
    };

    if (editandoID) await db.collection("productos").doc(editandoID).update(datos);
    else { datos.ventas = 0; await db.collection("productos").add(datos); }
    resetFormAdmin();
}

function renderProductos(lista) {
    const tienda = document.getElementById('product-container');
    const renta = document.getElementById('renta-container');
    const isAdmin = document.getElementById('adminPanel').style.display === 'block';
    if(!tienda || !renta) return;
    tienda.innerHTML = ''; renta.innerHTML = '';

    lista.forEach(p => {
        const isRenta = p.categoria === 'Renta';
        const stockActual = p.stock || 0;
        const estaDisponible = p.disponible && stockActual > 0;

        if (!estaDisponible && !isAdmin) return;

        const cardHtml = `
            <div class="card ${!estaDisponible ? 'sold-out' : ''}">
                <div>
                    <img src="${p.img || 'https://via.placeholder.com/300'}" style="${!estaDisponible ? 'filter: grayscale(1); opacity: 0.5;' : ''}">
                    <p style="color:orange; font-weight:bold; font-size:11px; margin:0;">${p.categoria.toUpperCase()}</p>
                    <h3>${p.nombre} ${!estaDisponible ? '<span style="color:red;">(AGOTADO)</span>' : ''}</h3>
                    ${isAdmin ? `<p style="font-size:12px; color:blue;">Stock: ${stockActual}</p>` : ''}
                </div>
                <div>
                    <p class="price">$${Number(p.precio).toLocaleString()}${isRenta ? ' / Día' : ''}</p>
                    ${estaDisponible ?
                        `<button onclick="comprar('${p.id}')">${isRenta ? 'APARTAR RENTA' : 'AGREGAR'}</button>` :
                        `<button disabled style="background:gray;">NO DISPONIBLE</button>`
                    }
                    ${isAdmin ? `<div style="margin-top:8px; display:flex; gap:5px;">
                        <button onclick="cargarDatosEditar('${p.id}')" style="background:black; flex:1; border:none; padding:5px; cursor:pointer; font-size:11px;">Editar</button>
                        <button onclick="eliminarProducto('${p.id}')" style="background:#dc3545; color:white; flex:1; border:none; padding:5px; cursor:pointer; font-size:11px;">Borrar</button>
                    </div>` : ''}
                </div>
            </div>`;
        if (isAdmin || !isRenta) tienda.innerHTML += cardHtml;
        if (!isAdmin && isRenta) renta.innerHTML += cardHtml;
    });
}

function buscarProducto() {
    const texto = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('catSelect').value;
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(texto) && (cat === "all" || p.categoria === cat));
    renderProductos(filtrados);
}

function cargarDatosEditar(id) {
    const p = productos.find(x => x.id === id);
    document.getElementById('newProdNombre').value = p.nombre;
    document.getElementById('newProdPrecio').value = p.precio;
    document.getElementById('newProdCat').value = p.categoria;
    document.getElementById('newProdImg').value = p.img;
    document.getElementById('newProdStock').value = p.stock || 0;
    editandoID = id;
    document.getElementById('btnGuardar').innerText = "💾 ACTUALIZAR EN MAQUINCO";
    window.scrollTo(0,0);
}

function resetFormAdmin() {
    document.getElementById('newProdNombre').value = '';
    document.getElementById('newProdPrecio').value = '';
    document.getElementById('newProdImg').value = '';
    document.getElementById('newProdCat').value = '';
    document.getElementById('newProdStock').value = '';
    document.getElementById('btnGuardar').innerText = "+ GUARDAR EN NUBE";
    editandoID = null;
}

async function eliminarProducto(id) { if(confirm("¿Borrar de MAQUINCO?")) await db.collection("productos").doc(id).delete(); }

function escucharProductos() {
    db.collection("productos").onSnapshot((snap) => {
        productos = []; snap.forEach(doc => productos.push({ id: doc.id, ...doc.data() }));
        buscarProducto();
        if(document.getElementById('adminPanel').style.display === 'block') cargarDatosAdmin();
    });
}

// --- LÓGICA DE COMPRAR O COTIZAR EN WHATSAPP ---
async function comprar(id) {
    const p = productos.find(x => x.id === id);
    const stockDisponible = p.stock || 0;

    if (!p || !p.disponible || stockDisponible <= 0) {
        return alert("Este producto ya no está disponible.");
    }

    if (p.categoria === 'Renta') {
        const telefonoMaquinco = "529612315072"; 
        const precioFormateado = Number(p.precio).toLocaleString();
        
        const mensajeWhatsApp = `Hola MAQUINCO, me interesa solicitar una cotización para la RENTA del siguiente equipo:\n\n` +
                                ` Equipo: ${p.nombre}\n` +
                                ` Precio base: $${precioFormateado} / Día\n\n` +
                                `¿Me podrían proporcionar información sobre la disponibilidad, flete y requisitos?`;

        const urlWhatsApp = `https://wa.me/${telefonoMaquinco}?text=${encodeURIComponent(mensajeWhatsApp)}`;
        window.open(urlWhatsApp, '_blank');
        return; 
    }

    productoTemporal = p;
    document.getElementById('qtyTitle').innerText = p.nombre;
    document.getElementById('qtyStock').innerText = `Disponibles: ${stockDisponible}`;
    document.getElementById('inputQty').value = 1;
    document.getElementById('inputQty').max = stockDisponible;

    document.getElementById('quantityModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';

    document.getElementById('btnConfirmarQty').onclick = function() {
        confirmarCompraConCantidad();
    };
}

function changeQty(valor) {
    const input = document.getElementById('inputQty');
    const max = parseInt(input.max);
    let nuevoValor = parseInt(input.value) + valor;
    if (nuevoValor >= 1 && nuevoValor <= max) {
        input.value = nuevoValor;
    }
}

function confirmarCompraConCantidad() {
    const cantidad = parseInt(document.getElementById('inputQty').value);
    const p = productoTemporal;
    const stockDisponible = p.stock || 0;

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > stockDisponible) {
        alert("Cantidad no válida o superior al stock.");
        return;
    }

    const indexExistente = carrito.findIndex(item => item.id === p.id);
    if (indexExistente !== -1) {
        let totalEnCarrito = carrito[indexExistente].cantidad + cantidad;
        if (totalEnCarrito > stockDisponible) {
            alert(`Ya tienes ${carrito[indexExistente].cantidad} en el carrito. No puedes agregar ${cantidad} más.`);
            return;
        }
        carrito[indexExistente].cantidad = totalEnCarrito;
    } else {
        carrito.push({ ...p, cantidad: cantidad });
    }

    if (typeof actualizarInterfazCarrito === 'function') actualizarInterfazCarrito();
    if (typeof guardarCarritoLocal === 'function') guardarCarritoLocal();
    cerrarQtyModal();
    if (typeof toggleCart === 'function') toggleCart();
}

function cerrarQtyModal() {
    document.getElementById('quantityModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    productoTemporal = null;
}

function abrirLogin() { document.getElementById('loginModal').style.display = 'flex'; }
function cerrarLogin() { document.getElementById('loginModal').style.display = 'none'; }

// === GESTIÓN DE PEDIDOS RECIBIDOS POR EL ADMIN (ACTUALIZADO CON RECUENTO DE CLIENTES Y 3 BOTONES DE ESTADO) ===
function escucharPedidosAdmin() {
    db.collection("pedidos").orderBy("fecha", "desc").onSnapshot((snap) => {
        const contenedor = document.getElementById('admin-pedidos-container');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (snap.empty) {
            contenedor.innerHTML = `<p style="color:#666; font-style:italic; padding: 10px;">No hay pedidos registrados en la base de datos.</p>`;
            const topClienteDiv = document.getElementById('topClienteContainer');
            if(topClienteDiv) topClienteDiv.innerHTML = '';
            return;
        }

        const conteoClientes = {};

        snap.forEach((doc) => {
            const pedido = doc.data();
            const id = doc.id;

            if (pedido.telefono) {
                conteoClientes[pedido.telefono] = (conteoClientes[pedido.telefono] || 0) + 1;
            }

            let productosHtml = '';
            if (Array.isArray(pedido.productos)) {
                pedido.productos.forEach(prod => {
                    productosHtml += `<div style="font-size:13px; color:#444;">• ${prod.nombre} (x${prod.cantidad || 1}) - $${Number(prod.precio * (prod.cantidad || 1)).toLocaleString()}</div>`;
                });
            }

            let fechaFormateada = "Fecha no disponible";
            if (pedido.fecha) {
                const d = pedido.fecha.toDate ? pedido.fecha.toDate() : new Date(pedido.fecha);
                fechaFormateada = d.toLocaleString();
            }

            let colorEstado = '#ffc107'; // Pendiente (Amarillo)
            if (pedido.estado === 'Preparacion') colorEstado = '#6c757d'; // Preparación (Gris)
            if (pedido.estado === 'Enviado') colorEstado = '#17a2b8'; // Enviado (Azul)
            if (pedido.estado === 'Completado') colorEstado = '#28a745'; // Completado (Verde)

            const cardPedido = `
                <div style="background:white; border:1px solid #ddd; border-radius:6px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #eee; padding-bottom:8px;">
                        <div>
                            <span style="font-size:12px; color:#777;">ID: ${id}</span>
                            <div style="font-size:14px; font-weight:bold; color:#1a1a1a;">📅 ${fechaFormateada}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="background:${colorEstado}; color:white; padding:4px 10px; font-size:12px; font-weight:bold; border-radius:20px;">${pedido.estado || 'Pendiente'}</span>
                            <button onclick="eliminarPedido('${id}')" style="background:#dc3545; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:12px;" title="Eliminar Pedido">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <div style="margin-bottom:5px;"><strong>📞 WhatsApp:</strong> <a href="https://wa.me/${pedido.telefono}" target="_blank" style="color:#25d366; font-weight:bold; text-decoration:none;">${pedido.telefono || 'N/A'} <i class="fab fa-whatsapp"></i></a></div>
                        <div style="margin-bottom:5px;"><strong>📍 Dirección:</strong> ${pedido.direccion || 'N/A'}</div>
                        <div style="margin-bottom:5px;"><strong>💳 Pago:</strong> ${pedido.metodoPago || 'N/A'}</div>
                    </div>

                    <div style="background:#f8f9fa; padding:10px; border-radius:4px; border-left:3px solid var(--primary, #fbc02d);">
                        <strong>🛒 Productos:</strong>
                        <div style="margin-top:5px;">${productosHtml}</div>
                        <div style="margin-top:8px; text-align:right; font-weight:bold; color:#1a1a1a; font-size:15px;">Total: $${Number(pedido.total || 0).toLocaleString()}</div>
                    </div>

                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;">
                        <button onclick="cambiarEstadoPedido('${id}', 'Preparacion')" style="flex:1; min-width:110px; background:#6c757d; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">🔨 PREPARACIÓN</button>
                        <button onclick="cambiarEstadoPedido('${id}', 'Enviado')" style="flex:1; min-width:110px; background:#17a2b8; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">🚚 EN CAMINO</button>
                        <button onclick="cambiarEstadoPedido('${id}', 'Completado')" style="flex:1; min-width:110px; background:#28a745; color:white; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">✅ ENTREGADO</button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += cardPedido;
        });

        let topClienteTelefono = "";
        let maxPedidos = 0;
        
        for (const tel in conteoClientes) {
            if (conteoClientes[tel] > maxPedidos) {
                maxPedidos = conteoClientes[tel];
                topClienteTelefono = tel;
            }
        }

        const topClienteDiv = document.getElementById('topClienteContainer');
        if (topClienteDiv && topClienteTelefono) {
            topClienteDiv.innerHTML = `
                <div style="background:#d4edda; color:#155724; padding:15px; margin-bottom:10px; border-radius:5px; border-left:5px solid #28a745;">
                    👑 <b>CLIENTE ESTRELLA :</b> 
                    <a href="https://wa.me/${topClienteTelefono}" target="_blank" style="color:#155724; font-weight:bold; text-decoration:underline;">
                        ${topClienteTelefono}
                    </a> 
                    con <b>${maxPedidos}</b> ordenes registradas.
                </div>
            `;
        }
    });
}

// === CAMBIA EL ESTADO Y NOTIFICA POR WHATSAPP AL CLIENTE SI SE MARCA ENVIADO ===
async function cambiarEstadoPedido(id, nuevoEstado) {
    try {
        const docRef = db.collection("pedidos").doc(id);
        const snapshot = await docRef.get();
        
        if (!snapshot.exists) {
            alert("No se encontró el pedido en la base de datos.");
            return;
        }
        
        const datosPedido = snapshot.data();
        await docRef.update({ estado: nuevoEstado });
        console.log(`Pedido ${id} updated to ${nuevoEstado}`);

        if (nuevoEstado === 'Enviado' && datosPedido.telefono) {
            let resumenProductos = '';
            if (Array.isArray(datosPedido.productos)) {
                datosPedido.productos.forEach(p => {
                    resumenProductos += `• ${p.nombre} (x${p.cantidad || 1})\n`;
                });
            }

            const linkRastreoMaquinco = `https://orsoer.github.io/maquinco/rastreo.html?id=${id}`;

            const mensajeCliente = `*MAQUINCO | Notificación de Envío* 🚚\n\n` +
                                   `¡Hola! Te informamos que tu pedido ya va en camino a la dirección proporcionada.\n\n` +
                                   ` Puedes consultar la ubicación y estatus de tu flete en tiempo real entrando aquí:\n` +
                                   `${linkRastreoMaquinco}\n\n` +
                                   `*Detalles del envío:*\n` +
                                   `📦 *ID Pedido:* ${id}\n` +
                                   `📍 *Dirección:* ${datosPedido.direccion || 'Dirección registrada'}\n` +
                                   `💳 *Método de Pago:* ${datosPedido.metodoPago || 'N/A'}\n\n` +
                                   `*Productos a entregar:*\n${resumenProductos}\n` +
                                   `💰 *Total a liquidar:* $${Number(datosPedido.total || 0).toLocaleString()}\n\n` +
                                   `Agradecemos tu preferencia. Si tienes dudas, nuestro repartidor se comunicará contigo al llegar. ¡Excelente día! ✨`;

            let numLimpio = datosPedido.telefono.replace(/[^0-9]/g, "");
            if (!numLimpio.startsWith("52") && numLimpio.length === 10) {
                numLimpio = "52" + numLimpio;
            }

            const urlEnvioNotificacion = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensajeCliente)}`;
            window.open(urlEnvioNotificacion, '_blank');
        }
    } catch (error) {
        console.error("Error al actualizar el estado del pedido: ", error);
        alert("No se pudo actualizar el estado del pedido.");
    }
}

// === ELIMINAR EL PEDIDO SELECCIONADO DE FIRESTORE ===
async function eliminarPedido(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este pedido de la base de datos? Esta acción no se puede deshacer.")) {
        try {
            await db.collection("pedidos").doc(id).delete();
            console.log(`Pedido ${id} eliminado con éxito.`);
        } catch (error) {
            console.error("Error al eliminar el pedido: ", error);
            alert("No se pudo eliminar el pedido de la base de datos.");
        }
    }
}

escucharProductos();