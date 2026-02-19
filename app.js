// URL de tu Google Apps Script (Debe estar implementado como Aplicación Web)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-_1v05LHK_MtVKkOeoNJ774p1l6vyKzfWL8g78oU6DvKWkZjaPLeMl5HNdyFUvpmBwA/exec";

// --- FUNCIÓN NÚCLEO PARA COMUNICARSE CON EL BACKEND ---
async function fetchAPI(payload) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain evita errores de CORS preflight
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error("Error en la conexión:", error);
        alert("Error de red. Verifica tu conexión a internet.");
        return null;
    }
}

// --- NAVEGACIÓN ---
function cambiarVista(id) {
    document.querySelectorAll('.view-section').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if (id === 'admin') cargarAdmin();
    if (id === 'scan' && !escaneando) iniciarCamara();
}

// --- 1. VENDER ---
async function procesarVenta() {
    const btn = document.getElementById('btnVender');
    const club = document.getElementById('selClub').value;
    
    btn.disabled = true;
    btn.innerText = "Procesando venta en servidor...";

    const res = await fetchAPI({ accion: "generar", club: club });

    if (res) {
        document.getElementById('txtClub').innerText = res.club;
        document.getElementById('txtId').innerText = res.id;
        document.getElementById('txtFecha').innerText = res.fecha;
        
        document.getElementById('qrDestino').innerHTML = "";
        new QRCode(document.getElementById('qrDestino'), {
            text: res.id,
            width: 150,
            height: 150
        });

        document.getElementById('ticketContainer').style.display = 'block';
    }
    
    btn.disabled = false;
    btn.innerText = "GENERAR TICKET (S/ 3.00)";
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
        pdf.save(`Entrada_${document.getElementById('txtId').innerText}.pdf`);
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
    divResultado.innerText = "Buscando QR...";
    divResultado.style.background = "#ddd";
    divResultado.style.color = "black";
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true); 
        video.play();
        requestAnimationFrame(loopCamara);
    })
    .catch(err => {
        divResultado.innerText = "Error: Permiso de cámara denegado.";
        divResultado.style.background = "#ea4335";
        divResultado.style.color = "white";
    });
}

function loopCamara() {
    if (!escaneando) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        document.getElementById("loadingInfo").hidden = true;
        canvasElement.hidden = false;
        canvasElement.height = video.videoHeight;
        canvasElement.width = video.videoWidth;
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        
        if (code) {
            escaneando = false; 
            verificarTicket(code.data);
        }
    }
    if(escaneando) {
        requestAnimationFrame(loopCamara);
    }
}

async function verificarTicket(id) {
    let div = document.getElementById('resultadoScan');
    div.innerText = "Verificando en servidor: " + id + "...";
    div.style.background = "#fbbc04"; // Amarillo
    div.style.color = "black";

    const res = await fetchAPI({ accion: "validar", id: id });

    if (res) {
        div.innerText = res.msg;
        div.style.background = res.color;
        div.style.color = "white";
        if (navigator.vibrate) navigator.vibrate(300); 
    } else {
        div.innerText = "Error de conexión. Intente de nuevo.";
        div.style.background = "#ea4335";
    }
}

// --- 3. ADMIN Y RANKING ---
async function cargarAdmin() {
    const btn = document.getElementById('btnActualizarAdmin');
    btn.innerText = "Cargando...";
    btn.disabled = true;

    const res = await fetchAPI({ accion: "dashboard" });

    if (res) {
        document.getElementById('stHoy').innerText = res.hoy;
        document.getElementById('stTotal').innerText = res.total;
        document.getElementById('stDinero').innerText = `S/ ${(res.total * 3).toFixed(2)}`;

        // Renderizar Ranking
        let htmlRanking = "";
        res.ranking.forEach((item, index) => {
            let medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "▪️";
            htmlRanking += `
                <div class="ranking-item">
                    <span class="ranking-club">${medalla} ${item.club}</span>
                    <span class="ranking-count">${item.cantidad} tickets</span>
                </div>
            `;
        });
        
        if(res.ranking.length === 0) htmlRanking = "<p style='text-align:center'>No hay ventas aún.</p>";
        
        document.getElementById('rankingClubes').innerHTML = htmlRanking;
    }

    btn.innerText = "🔄 Actualizar Datos";
    btn.disabled = false;
}