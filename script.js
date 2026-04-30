// 1. CONFIGURACIÓN (image_0e2c7a.png)
const firebaseConfig = {
  apiKey: "AIzaSyDFelwUOlRNToZsgKl23wVB8mlG6LNHD6s",
  authDomain: "maquinco-tuxtla.firebaseapp.com",
  projectId: "maquinco-tuxtla",
  storageBucket: "maquinco-tuxtla.firebasestorage.app",
  messagingSenderId: "324439294195",
  appId: "1:324439294195:web:9e150a9e3e8c170c3c3786",
  measurementId: "G-0SJB8VNQNW"
};

// Inicializar
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let productos = [];
let carrito = [];
let total = 0;

// --- SISTEMA DE AUTENTICACIÓN ---

// Registro con Correo y Notificación
async function registroReal() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    const msg = document.getElementById('authMsg');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        await userCredential.user.sendEmailVerification();
        alert("¡Cuenta creada! Te hemos enviado un correo de verificación.");
        msg.style.color = "green";
        msg.innerText = "Verificación enviada a tu correo.";
    } catch (error) {
        msg.style.color = "red";
        msg.innerText = error.message;
    }
}

// Login con Correo
async function loginReal() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPass').value;
    const msg = document.getElementById('authMsg');

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        cerrarLogin();
    } catch (error) {
        msg.innerText = "Error: Credenciales incorrectas.";
    }
}

// Login con Google
async function loginConGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        cerrarLogin();
    } catch (error) {
        alert("Error al conectar con Google");
    }
}

function cerrarSesion() {
    auth.signOut();
    cerrarLogin();
}

// Observador de usuario
auth.onAuthStateChanged((user) => {
    const statusText = document.getElementById('userNameStatus');
    const btnLogout = document.getElementById('btnCerrarSesion');
    const inputs = document.getElementById('authInputs');

    if (user) {
        statusText.innerText = user.displayName || user.email.split('@')[0];
        btnLogout.style.display = "block";
        inputs.style.display = "none";
    } else {
        statusText.innerText = "Inicia Sesión";
        btnLogout.style.display = "none";
        inputs.style.display = "block";
    }
});

// --- SISTEMA DE PRODUCTOS (FIRESTORE) ---

function escucharProductos() {
    db.collection("productos").onSnapshot((snapshot) => {
        productos = [];
        snapshot.forEach(doc => productos.push({ id: doc.id, ...doc.data() }));
        buscarProducto();
    });
}

async function agregarProducto() {
    const nombre = document.getElementById('newProdNombre').value;
    const precio = document.getElementById('newProdPrecio').value;
    const cat = document.getElementById('newProdCat').value;
    const img = document.getElementById('newProdImg').value;

    if (nombre && precio) {
        await db.collection("productos").add({
            nombre: nombre,
            precio: parseFloat(precio),
            categoria: cat || "Maquinaria",
            img: img || "https://via.placeholder.com/400?text=Maquinco",
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("¡Guardado en la nube!");
        document.getElementById('newProdNombre').value = '';
        document.getElementById('newProdPrecio').value = '';
    }
}

async function eliminarProducto(id) {
    if(confirm("¿Eliminar permanentemente?")) {
        await db.collection("productos").doc(id).delete();
    }
}

function renderProductos(lista) {
    const container = document.getElementById('product-container');
    const isAdmin = document.getElementById('adminPanel').style.display === 'block';
    container.innerHTML = '';
    
    lista.forEach(p => {
        container.innerHTML += `
            <div class="card">
                <img src="${p.img}">
                <p style="font-size: 11px; color: var(--primary); font-weight:bold;">${p.categoria.toUpperCase()}</p>
                <h3>${p.nombre}</h3>
                <p class="price"><strong>$${Number(p.precio).toLocaleString()}</strong></p>
                <button onclick="comprar('${p.id}')" style="width:100%; padding:10px; background:var(--dark); color:var(--primary); border:none; border-radius:5px; cursor:pointer; font-weight:bold; margin-top:10px;">AGREGAR</button>
                ${isAdmin ? `<button onclick="eliminarProducto('${p.id}')" style="width:100%; padding:8px; background:#ff4444; color:white; border:none; border-radius:5px; cursor:pointer; margin-top:8px; font-size:11px;">ELIMINAR</button>` : ''}
            </div>
        `;
    });
}

function buscarProducto() {
    const texto = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('catSelect').value;
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(texto) && (cat === "all" || p.categoria === cat)
    );
    renderProductos(filtrados);
}

// --- INTERFAZ ---

function abrirLogin() { document.getElementById('loginModal').style.display = 'flex'; }
function cerrarLogin() { document.getElementById('loginModal').style.display = 'none'; }

function abrirAdmin() { 
    if(prompt("Clave Admin:") === "admin123") {
        document.getElementById('adminPanel').style.display = 'block';
        buscarProducto();
    }
}
function cerrarAdmin() { 
    document.getElementById('adminPanel').style.display = 'none';
    buscarProducto();
}

function comprar(id) {
    const p = productos.find(x => x.id === id);
    carrito.push(p);
    total += p.precio;
    document.getElementById('cart-count').innerText = carrito.length;
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`;
}

// Iniciar
escucharProductos();