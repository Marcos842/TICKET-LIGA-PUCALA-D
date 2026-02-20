const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwckUuup4pvDDEeM1K2b-VY5aXxlRLDbE_bRWRW3jKcTv8g94kCCJ5Pdq7Qk8o3aiWNaw/exec";

let usuarioActual = "";
let rolActual = ""; 

// --- INICIALIZACIÓN Y RECUPERACIÓN DE SESIÓN ---
window.onload = function() {
    // 1. Recuperación de sesión
    const usrGuardado = localStorage.getItem('ligaUsuario');
    const rolGuardado = localStorage.getItem('ligaRol');
    if (usrGuardado && rolGuardado) {
        usuarioActual = usrGuardado;
        rolActual = rolGuardado;
        accederApp(true);
    }

    // 2. Eventos UI: Controlador del selector de cantidad manual
    const selCantidad = document.getElementById('selCantidad');
    if(selCantidad) {
        selCantidad.addEventListener('change', function() {
            const inputDiv = document.getElementById('inputManual');
            if (this.value === 'manual') {
                inputDiv.style.display = 'block';
                inputDiv.focus();
            } else {
                inputDiv.style.display = 'none';
                inputDiv.value = ''; // Limpia el valor si se oculta
            }
        });
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
        console.error("Error API:", error);
        return { error: "Error de red. Verifique su conexión." };
    }
}

// --- SISTEMA DE LOGIN ---
async function iniciarSesion() {
    const nombre = document.getElementById('inputNombre').value.trim();
    const pass = document.getElementById('inputPass').value.trim();
    const btn = document.getElementById('btnLogin');

    if (!nombre) { alert("Por favor, ingresa tu nombre."); return; }

    let rolCalculado = "";
    if (pass === "admin2026") rolCalculado = "ADMINISTRADOR";
    else if (pass === "scan2026") rolCalculado = "VENDEDOR";
    else { alert("Contraseña incorrecta."); return; }

    btn.innerText = "Verificando...";
    btn.disabled = true;

    const res = await fetchAPI({ accion: "registrar_login", usuario: nombre, rol: rolCalculado });

    btn.disabled = false;
    btn.innerText = "INGRESAR";

    if (res.error) { alert(res.error); return; }

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
    apagarCamara(); 
    usuarioActual = ""; rolActual = "";
    localStorage.removeItem('ligaUsuario');
    localStorage.removeItem('ligaRol');
    location.reload(); 
}

// --- NAVEGACIÓN ---
function cambiarVista(id) {
    document.querySelectorAll('.view-section').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (id !== 'scan') {
        apagarCamara();
    }

    if (id === 'vender') document.getElementById('navVender').classList.add('active');
    if (id === 'scan') {
        document.getElementById('navScan').classList.add('active');
        iniciarCamara(); 
    }
    if (id === 'admin') {
        document.getElementById('navAdmin').classList.add('active');
        cargarAdmin();
    }
}

// --- GENERADOR DE CÓDIGO ÚNICO (5 CARACTERES) ---
function generarCodigoUnico() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 5; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
}

// --- 1. VENDER TICKETS (SOPORTE MASIVO Y MANUAL) ---
async function procesarVenta() {
    const btn = document.getElementById('btnVender');
    const club = document.getElementById('selClub').value;
    const opcionCantidad = document.getElementById('selCantidad').value;
    
    let cantidad = 1;

    // Lógica de validación para entrada manual o predefinida
    if (opcionCantidad === 'manual') {
        cantidad = parseInt(document.getElementById('inputManual').value);
        if (isNaN(cantidad) || cantidad <= 0) {
            alert("Por favor, ingresa una cantidad manual válida mayor a 0.");
            return;
        }
        if (cantidad > 50) {
            alert("Por seguridad del sistema, el límite máximo por lote es de 50 tickets.");
            return;
        }
    } else {
        cantidad = parseInt(opcionCantidad || 1);
    }
    
    btn.disabled = true; 
    btn.innerText = `Generando ${cantidad} ticket(s)...`;

    const loteTickets = [];
    for(let i = 0; i < cantidad; i++) {
        loteTickets.push(generarCodigoUnico());
    }

    const res = await fetchAPI({ 
        accion: "generar_masivo", 
        club: club, 
        usuario: usuarioActual,
        ids: loteTickets 
    });

    if (res && !res.error) {
        generarDocumentoVenta(res.tickets);
    } else {
        alert("Error al registrar la venta masiva.");
    }
    btn.disabled = false; 
    btn.innerText = "GENERAR TICKETS (S/ 3.00)";
}

async function generarDocumentoVenta(tickets) {
    const { jsPDF } = window.jspdf;
    
    // CAMBIO TÉCNICO: Formato A7 (74 mm x 105 mm) - Más pequeño y portable
    const pdf = new jsPDF('p', 'mm', 'a7'); 
    const qrTemp = document.createElement("div");

    for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (i > 0) pdf.addPage();

        qrTemp.innerHTML = "";
        new QRCode(qrTemp, { text: t.id, width: 200, height: 200 });
        
        await new Promise(r => setTimeout(r, 100));
        const imgData = qrTemp.querySelector('img').src;

        // --- DISEÑO ESCALADO Y CENTRADO MATEMÁTICAMENTE ---
        const centroX = 37; // La mitad de 74mm (Ancho del A7)

        pdf.setFontSize(8);
        pdf.text("LIGA DISTRITAL DE FUTBOL PUCALA", centroX, 12, { align: "center" });
        
        pdf.setFontSize(11);
        pdf.text(`CLUB: ${t.club}`, centroX, 20, { align: "center" });
        
        pdf.setFontSize(7);
        pdf.text(`FECHA: ${t.fecha}`, centroX, 26, { align: "center" });
        pdf.text(`VENDEDOR: ${usuarioActual}`, centroX, 30, { align: "center" });
        
        // QR Reducido a 32x32 mm. Para centrarlo: 37 - (32/2) = 21
        pdf.addImage(imgData, 'PNG', 21, 35, 32, 32);
        
        pdf.setFontSize(14);
        pdf.text(`ID: ${t.id}`, centroX, 75, { align: "center" });
        
        pdf.setFontSize(10);
        pdf.text("VALOR: S/ 3.00", centroX, 83, { align: "center" });
    }

    pdf.save(`Tickets_${tickets[0].club}_${Date.now()}.pdf`);
    alert(`Se han generado exitosamente ${tickets.length} tickets.`);
    const tc = document.getElementById('ticketContainer');
    if(tc) tc.style.display = 'none';
}

// --- 2. ESCÁNER (CÁMARA) MEJORADO ---
let video = document.createElement("video");
let canvasElement = document.getElementById("canvas");
let canvas = canvasElement.getContext("2d");
let escaneando = false;

function apagarCamara() {
    escaneando = false;
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function iniciarCamara() {
    apagarCamara(); 
    escaneando = true;
    
    let divResultado = document.getElementById('resultadoScan');
    let loadingInfo = document.getElementById('loadingInfo');
    
    divResultado.innerText = "Iniciando cámara..."; 
    divResultado.style.background = "#ddd"; 
    divResultado.style.color = "black";
    
    if (loadingInfo) loadingInfo.style.display = "block";
    canvasElement.hidden = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        divResultado.innerText = "Error: Navegador no soporta cámara o el sitio no es seguro (HTTPS)."; 
        divResultado.style.background = "#ea4335";
        divResultado.style.color = "white";
        if (loadingInfo) loadingInfo.style.display = "none";
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
        video.srcObject = stream; 
        video.setAttribute("playsinline", true); 
        video.play();
        requestAnimationFrame(loopCamara);
    }).catch(err => {
        console.error("Error acceso cámara:", err);
        divResultado.innerText = "Permiso denegado o cámara en uso."; 
        divResultado.style.background = "#ea4335";
        divResultado.style.color = "white";
        if (loadingInfo) loadingInfo.style.display = "none";
    });
}

function loopCamara() {
    if (!escaneando) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        let loadingInfo = document.getElementById('loadingInfo');
        if (loadingInfo) loadingInfo.style.display = "none";
        
        canvasElement.hidden = false;
        canvasElement.height = video.videoHeight; 
        canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        
        if (code) { 
            apagarCamara(); 
            verificarTicket(code.data); 
        }
    }
    
    if(escaneando) requestAnimationFrame(loopCamara);
}

async function verificarTicket(id) {
    let div = document.getElementById('resultadoScan');
    div.innerText = "Verificando: " + id; div.style.background = "#fbbc04"; div.style.color = "black";

    const res = await fetchAPI({ accion: "validar", id: id, usuario: usuarioActual });

    if (res && !res.error) {
        div.innerText = res.msg; div.style.background = res.color; div.style.color = "white";
        if (navigator.vibrate) navigator.vibrate(300); 
    } else {
        div.innerText = "Error validando en servidor."; div.style.background = "#ea4335"; div.style.color = "white";
    }
    
    setTimeout(() => { iniciarCamara(); }, 3000); 
}

// --- 3. ADMIN Y RANKING ---
async function cargarAdmin() {
    const btn = document.getElementById('btnActualizarAdmin');
    btn.innerText = "Cargando..."; btn.disabled = true;

    const res = await fetchAPI({ accion: "dashboard" });

    if (res && !res.error) {
        document.getElementById('stHoy').innerText = res.hoy;
        document.getElementById('stDinero').innerText = `S/ ${(res.total * 3).toFixed(2)}`;

        let htmlRanking = "";
        res.ranking.forEach((item, index) => {
            let esTop1 = index === 0 && item.cantidad > 0 ? "top-1" : "";
            let icono = (index === 0 && item.cantidad > 0) ? "👑" : "▪️";
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
