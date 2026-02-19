const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5I_Cq4yBDPtDuAB9Wfc2DWg9J9V0bB4FmCBxBLV6cHOCOvmUsPGcnrG9MvYqAKM04hQ/exec";

let usuarioActual = "";
let rolActual = ""; 

// --- RECUPERACIÓN DE SESIÓN ---
window.onload = function() {
    const usrGuardado = localStorage.getItem('ligaUsuario');
    const rolGuardado = localStorage.getItem('ligaRol');
    if (usrGuardado && rolGuardado) {
        usuarioActual = usrGuardado;
        rolActual = rolGuardado;
        accederApp(true);
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

    btn.innerText = "Verificando nombre...";
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

// --- 1. VENDER TICKETS (SOPORTE MASIVO) ---
async function procesarVenta() {
    const btn = document.getElementById('btnVender');
    const club = document.getElementById('selClub').value;
    const cantidad = parseInt(document.getElementById('selCantidad')?.value || 1);
    
    btn.disabled = true; 
    btn.innerText = `Generando ${cantidad} ticket(s)...`;

    // Preparar lote de IDs
    const loteTickets = [];
    const timestamp = Date.now();
    for(let i=0; i<cantidad; i++) {
        loteTickets.push(`LP-${timestamp}-${i}`);
    }

    // Llamada al backend optimizada
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
    btn.innerText = "GENERAR TICKET (S/ 3.00)";
}

async function generarDocumentoVenta(tickets) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a6');
    const qrTemp = document.createElement("div");

    for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (i > 0) pdf.addPage();

        // Limpiar y generar nuevo QR
        qrTemp.innerHTML = "";
        new QRCode(qrTemp, { text: t.id, width: 200, height: 200 });
        
        // Pausa técnica para render de QR
        await new Promise(r => setTimeout(r, 100));
        const imgData = qrTemp.querySelector('img').src;

        // Diseño del PDF
        pdf.setFontSize(10);
        pdf.text("LIGA DISTRITAL DE FUTBOL PUCALA", 10, 15);
        pdf.setFontSize(14);
        pdf.text(`CLUB: ${t.club}`, 10, 25);
        pdf.setFontSize(9);
        pdf.text(`ID: ${t.id}`, 10, 32);
        pdf.text(`FECHA: ${t.fecha}`, 10, 37);
        pdf.text(`VENDEDOR: ${usuarioActual}`, 10, 42);
        pdf.addImage(imgData, 'PNG', 20, 50, 65, 65);
        pdf.text("VALOR: S/ 3.00", 40, 125);
    }

    pdf.save(`Tickets_${tickets[0].club}_${Date.now()}.pdf`);
    alert(`Se han generado exitosamente ${tickets.length} tickets.`);
    document.getElementById('ticketContainer').style.display = 'none'; // Reset vista
}

// --- 2. ESCÁNER (CÁMARA) ---
let video = document.createElement("video");
let canvasElement = document.getElementById("canvas");
let canvas = canvasElement.getContext("2d");
let escaneando = false;

function iniciarCamara() {
    escaneando = true;
    let divResultado = document.getElementById('resultadoScan');
    divResultado.innerText = "Buscando QR..."; divResultado.style.background = "#ddd"; 
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
        video.srcObject = stream; video.setAttribute("playsinline", true); video.play();
        requestAnimationFrame(loopCamara);
    }).catch(err => {
        divResultado.innerText = "Permiso de cámara denegado."; divResultado.style.background = "#ea4335";
    });
}

function loopCamara() {
    if (!escaneando) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight; canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) { 
            escaneando = false; 
            if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
            verificarTicket(code.data); 
        }
    }
    if(escaneando) requestAnimationFrame(loopCamara);
}

async function verificarTicket(id) {
    let div = document.getElementById('resultadoScan');
    div.innerText = "Verificando: " + id; div.style.background = "#fbbc04";

    const res = await fetchAPI({ accion: "validar", id: id, usuario: usuarioActual });

    if (res && !res.error) {
        div.innerText = res.msg; div.style.background = res.color; div.style.color = "white";
        if (navigator.vibrate) navigator.vibrate(300); 
    }
    setTimeout(() => { if(!escaneando) iniciarCamara(); }, 3000); // Reinicia cámara tras 3 seg
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
