const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzv8t19bqLaegVup1ICK1xaJeQmbZvFWHfRPNHdm6-uTUTB6Ow8rgZdE497_B1jG3VIyw/exec";

let usuarioActual = "";
let rolActual = ""; 

// --- RECUPERACIÓN DE SESIÓN (Evita perder datos al recargar F5) ---
window.onload = function() {
    const usrGuardado = localStorage.getItem('ligaUsuario');
    const rolGuardado = localStorage.getItem('ligaRol');
    if (usrGuardado && rolGuardado) {
        usuarioActual = usrGuardado;
        rolActual = rolGuardado;
        accederApp(true); // Entra directo sin preguntar al Drive
    }
}

// --- COMUNICACIÓN CON BACKEND ---
async function fetchAPI(payload) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error("Error:", error);
        return { error: "Error de red. Verifique su conexión." };
    }
}

// --- SISTEMA DE LOGIN CON VALIDACIÓN DE DUPLICADOS ---
async function iniciarSesion() {
    const nombre = document.getElementById('inputNombre').value.trim();
    const pass = document.getElementById('inputPass').value.trim();
    const btn = document.getElementById('btnLogin');

    if (!nombre) { alert("Por favor, ingresa tu nombre."); return; }

    let rolCalculado = "";
    if (pass === "admin2026") rolCalculado = "ADMINISTRADOR";
    else if (pass === "scan2026") rolCalculado = "VENDEDOR";
    else { alert("Contraseña incorrecta."); return; }

    // Cambiar estado del botón
    btn.innerText = "Verificando nombre en Drive...";
    btn.disabled = true;

    // Preguntar al servidor si el nombre ya existe
    const res = await fetchAPI({ accion: "registrar_login", usuario: nombre, rol: rolCalculado });

    btn.disabled = false;
    btn.innerText = "INGRESAR";

    if (res.error) {
        // Muestra alerta si el usuario está duplicado
        alert(res.error); 
        return; 
    }

    // Si todo sale bien, guardar sesión localmente y entrar
    usuarioActual = nombre;
    rolActual = rolCalculado;
    localStorage.setItem('ligaUsuario', nombre);
    localStorage.setItem('ligaRol', rolCalculado);
    accederApp(false);
}

function accederApp(desdeMemoria) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('lblUsuario').innerText = "👤 " + usuarioActual + " (" + rolActual + ")";

    if (rolActual === "VENDEDOR") {
        document.getElementById('navVender').style.display = 'none';
        document.getElementById('navAdmin').style.display = 'none';
        cambiarVista('scan'); 
    } else {
        document.getElementById('navVender').style.display = 'inline-block';
        document.getElementById('navAdmin').style.display = 'inline-block';
        cambiarVista('admin'); 
    }
}

function cerrarSesion() {
    usuarioActual = ""; rolActual = "";
    localStorage.removeItem('ligaUsuario');
    localStorage.removeItem('ligaRol');
    
    document.getElementById('inputNombre').value = "";
    document.getElementById('inputPass').value = "";
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginSection').style.display = 'flex';
    if(escaneando) escaneando = false; 
}

// --- NAVEGACIÓN INTERNA ---
function cambiarVista(id) {
    document.querySelectorAll('.view-section').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (id === 'vender') document.getElementById('navVender').classList.add('active');
    if (id === 'scan') {
        document.getElementById('navScan').classList.add('active');
        if (!escaneando) iniciarCamara();
    }
    if (id === 'admin') {
        document.getElementById('navAdmin').classList.add('active');
        cargarAdmin();
    }
}

// --- 1. VENDER TICKET ---
async function procesarVenta() {
    const btn = document.getElementById('btnVender');
    const club = document.getElementById('selClub').value;
    
    btn.disabled = true; btn.innerText = "Registrando en Drive...";

    const res = await fetchAPI({ accion: "generar", club: club, usuario: usuarioActual });

    if (res && !res.error) {
        document.getElementById('txtClub').innerText = res.club;
        document.getElementById('txtId').innerText = res.id;
        document.getElementById('txtFecha').innerText = res.fecha;
        document.getElementById('txtVendedorTicket').innerText = usuarioActual;
        
        document.getElementById('qrDestino').innerHTML = "";
        new QRCode(document.getElementById('qrDestino'), { text: res.id, width: 150, height: 150 });
        document.getElementById('ticketContainer').style.display = 'block';
    } else {
        alert("Error al registrar la venta.");
    }
    btn.disabled = false; btn.innerText = "GENERAR TICKET (S/ 3.00)";
}

function bajarPDF() {
    const { jsPDF } = window.jspdf;
    const elemento = document.getElementById('ticketVisual');
    html2canvas(elemento, { scale: 3 }).then(canvas => {
        const img = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a6');
        const ancho = pdf.internal.pageSize.getWidth();
        const alto = (canvas.height * ancho) / canvas.width;
        pdf.addImage(img, 'PNG', 0, 10, ancho, alto);
        pdf.save(`Ticket_${document.getElementById('txtId').innerText}.pdf`);
    });
}

// --- 2. ESCÁNER (CÁMARA) ---
let video = document.createElement("video");
let canvasElement = document.getElementById("canvas");
let canvas = canvasElement.getContext("2d");
let escaneando = false;

function iniciarCamara() {
    escaneando = true;
    let divResultado = document.getElementById('resultadoScan');
    divResultado.innerText = "Buscando QR..."; divResultado.style.background = "#ddd"; divResultado.style.color = "black";
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
        video.srcObject = stream; video.setAttribute("playsinline", true); video.play();
        requestAnimationFrame(loopCamara);
    }).catch(err => {
        divResultado.innerText = "Permiso de cámara denegado."; divResultado.style.background = "#ea4335"; divResultado.style.color = "white";
    });
}

function loopCamara() {
    if (!escaneando) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        document.getElementById("loadingInfo").hidden = true; canvasElement.hidden = false;
        canvasElement.height = video.videoHeight; canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) { escaneando = false; verificarTicket(code.data); }
    }
    if(escaneando) requestAnimationFrame(loopCamara);
}

async function verificarTicket(id) {
    let div = document.getElementById('resultadoScan');
    div.innerText = "Verificando en Drive: " + id + "..."; div.style.background = "#fbbc04"; div.style.color = "black";

    const res = await fetchAPI({ accion: "validar", id: id, usuario: usuarioActual });

    if (res && !res.error) {
        div.innerText = res.msg; div.style.background = res.color; div.style.color = "white";
        if (navigator.vibrate) navigator.vibrate(300); 
    } else {
        div.innerText = "Error de conexión."; div.style.background = "#ea4335";
    }
}

// --- 3. ADMIN Y RANKING ---
async function cargarAdmin() {
    const btn = document.getElementById('btnActualizarAdmin');
    btn.innerText = "Cargando datos del Drive..."; btn.disabled = true;

    const res = await fetchAPI({ accion: "dashboard" });

    if (res && !res.error) {
        document.getElementById('stHoy').innerText = res.hoy;
        document.getElementById('stDinero').innerText = `S/ ${(res.total * 3).toFixed(2)}`;

        let htmlRanking = "";
        res.ranking.forEach((item, index) => {
            let esTop1 = index === 0 && item.cantidad > 0 ? "top-1" : "";
            let icono = "";
            if (index === 0 && item.cantidad > 0) icono = "👑";
            else if (index === 1 && item.cantidad > 0) icono = "🥈";
            else if (index === 2 && item.cantidad > 0) icono = "🥉";
            else icono = "▪️";

            htmlRanking += `
                <div class="ranking-item ${esTop1}">
                    <span class="ranking-club">${icono} ${item.club}</span>
                    <span class="ranking-count">${item.cantidad} tickets</span>
                </div>`;
        });
        document.getElementById('rankingClubes').innerHTML = htmlRanking;
    }
    btn.innerText = "🔄 Actualizar Datos"; btn.disabled = false;
}
