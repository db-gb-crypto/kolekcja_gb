
function safe(v){return v??"-";}

function escapeHTML(str){
    return String(str)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");
}



function fetchTx(txid){
    return fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`);
}



function hexToUtf8(hex){
    try{
        let bytes = hex.match(/.{1,2}/g).map(b => parseInt(b,16));
        return new TextDecoder().decode(new Uint8Array(bytes));
    }catch(e){
        return null;
    }
}

function copyTX(el) {
    const full = el.getAttribute("data-full");

    navigator.clipboard.writeText(full);

    const old = el.innerText;
    el.innerText = "SKOPIOWANO!";
    el.style.color = "yellow";

    setTimeout(() => {
        el.innerText = old;
        el.style.color = "lime";
    }, 1500);
}

function extractGameData(parts){

    for(let p of parts){

        let text = p;

        // HEX → UTF8
        if(/^[0-9a-fA-F]+$/.test(p)){
            let decoded = hexToUtf8(p);
            if(decoded) text = decoded;
        }


        let match = text.match(/\{.*\}/s);

        if(match){
            try{
                return JSON.parse(match[0]);
            }catch(e){}
        }
    }

    return null;
}


function sprawdzTx(){
	document.getElementById("gifStatus").src = "assets/4SHX.gif";
	document.getElementById("gifLabel").innerHTML = "⏳ ŁADOWANIE BLOKCHAIN...";
    const txid=document.getElementById("txid").value.trim();
    const out=document.getElementById("output");

    if(!/^[0-9a-fA-F]{64}$/.test(txid)){
        out.innerHTML="❌ BŁĘDNY NUMER TXID";
        return;
    }

    out.innerHTML="LOADING...";

    fetchTx(txid)
        .then(r=>r.json())
        .then(d=>{

            let found=null;

            for(let v of d.vout){

                // standard
                let p=v.scriptPubKey?.opReturn?.parts;

                if(!p && v.scriptPubKey?.asm){
                    p=v.scriptPubKey.asm.split(" ");
                }

                if(!p) continue;

                found=extractGameData(p);
                if(found) break;
            }

            if(!found) throw new Error("❌ BRAK DANYCH - SPRÓBUJ INNEGO TXID 😄");
				document.getElementById("gifStatus").src = "assets/7efs.gif";
				document.getElementById("gifLabel").innerHTML = "✔ DANE ODNALEZIONE — ARCHIWUM AKTYWNE";

            out.innerHTML=`

				<h3>${escapeHTML(safe(found.tytul))}</h3><br>
				<b>NUMER KOLEKCJI (ID): ${escapeHTML(safe(found.id))}</b><br>
				TEN EGZEMPLARZ ZOSTAŁ WYDANY W  ${escapeHTML(safe(found.rok_wydania))} ROKU!<br><br>

				<b>OBUDOWA</b><br>
				Kod: ${escapeHTML(safe(found.obudowa?.kod))}<br>
				Wytłoczenie: ${escapeHTML(safe(found.obudowa?.kod_wytloczenia))}<br>
				Przód: ${escapeHTML(safe(found.obudowa?.kod_obudowy_przod))}<br>
				Tył: ${escapeHTML(safe(found.obudowa?.kod_obudowy_tyl))}<br><br>

				<b>PCB</b><br>
				Kod: ${escapeHTML(safe(found.pcb?.kod_pcb))}<br><br>

				<b>ROM</b><br>
				Kod: ${escapeHTML(safe(found.pcb?.rom?.rom_kod))}<br>
				Producent: ${escapeHTML(safe(found.pcb?.rom?.rom_producent))}<br>
				Data produkcji: ${escapeHTML(safe(found.pcb?.rom?.rom_data_int))}<br>
				Data RAW: ${escapeHTML(safe(found.pcb?.rom?.rom_data_serial))}<br><br>

				<b>MBC</b><br>
				Kod: ${escapeHTML(safe(found.pcb?.mbc?.mbc_kod))}<br>
				Data produkcji: ${escapeHTML(safe(found.pcb?.mbc?.mbc_data_int))}<br>
				Data RAW: ${escapeHTML(safe(found.pcb?.mbc?.mbc_data_serial))}<br><br>

				Metoda inspekcji: ${escapeHTML(safe(found.metoda_inspekcji))}<br>
				Nazwa oryginalnego obrazu: ${escapeHTML(safe(found.sciezka_obrazu))}<br>
				Hash obrazu: ${escapeHTML(safe(found.hash_obrazu))}<br>
				Data wpisu do lokalnej bazy: ${escapeHTML(safe(found.data_wpisu))}<br>
				Data utworzenia wpisu do blockchain: ${escapeHTML(safe(found.data_txid))}
			`;
			document.getElementById("resetBtn").style.display = "inline-block";
        })
        .catch(e=>{
            out.innerHTML="ERROR: "+e.message;
			document.getElementById("resetBtn").style.display = "inline-block";
			document.getElementById("gifStatus").src = "assets/ZZ5H.gif";
			document.getElementById("gifLabel").innerHTML = "❌ BRAK DANYCH — SYGNAŁ PRZERWANY";
        });
}

function resetView(){
    document.getElementById("txid").value = "";
    document.getElementById("output").innerHTML = "▌";
    document.getElementById("resetBtn").style.display = "none";
	document.getElementById("gifStatus").src = "assets/7VE.gif";
    document.getElementById("gifLabel").innerHTML = "OCZEKIWANIE NA DANE...";
}

const logLines = [
    { t: "INFO", msg: "INIT: system boot sequence started..." },
    { t: "SCAN", msg: "LIVE PACKET SNIFFING ACTIVE..." },
    { t: "OK", msg: "BLOCKCHAIN NODE CONNECTED" },
    { t: "WARN", msg: "DELAY DETECTED IN NETWORK LAYER" },
    { t: "INFO", msg: "ROM DATABASE SYNCING..." },
    { t: "OK", msg: "PCB SCAN MODULE READY" },
    { t: "SCAN", msg: "ANALYZING OP_RETURN STREAM..." },
];

let logIndex = 0;

function addLogLine(){
    const log = document.getElementById("logWindow");
    if(!log) return;

    const entry = logLines[logIndex % logLines.length];
    logIndex++;

    let cls = "log-ok";
    if(entry.t === "WARN") cls = "log-warn";
    if(entry.t === "ERROR") cls = "log-error";
    if(entry.t === "SCAN") cls = "log-scan";

    const line = document.createElement("div");
    line.className = cls;
    log.appendChild(line);

    typeWriter(line, `▸ ${entry.t}: ${entry.msg}`);

    log.scrollTop = log.scrollHeight;

    if(Math.random() < 0.15){
        setTimeout(() => {
            const err = document.createElement("div");
            err.className = "log-error";
            log.appendChild(err);
            typeWriter(err, "▸ ERROR: PACKET CORRUPTION DETECTED");
            log.scrollTop = log.scrollHeight;
        }, 400);
    }
}

function typeWriter(el, text, i = 0){
    if(i < text.length){
        el.innerHTML += text.charAt(i);
        setTimeout(() => typeWriter(el, text, i + 1), 15);
    }
}

function startLiveLog(){
    setInterval(addLogLine, 1200);
}

startLiveLog();


const trailSymbols = ["✦", "✧", "★", "☆", "✶"];
const trailColors = ["cyan", "magenta", "lime", "yellow"];

let lastTrailTime = 0;

document.addEventListener("mousemove", function(e){
    const now = Date.now();
    if(now - lastTrailTime < 40) return; // throttling — nie zapycha DOM
    lastTrailTime = now;

    const star = document.createElement("div");
    star.className = "cursor-star";
    star.textContent = trailSymbols[Math.floor(Math.random() * trailSymbols.length)];
    star.style.left = e.clientX + "px";
    star.style.top = e.clientY + "px";
    star.style.color = trailColors[Math.floor(Math.random() * trailColors.length)];

    document.body.appendChild(star);

    setTimeout(() => star.remove(), 700);
});


const titleFrames = [
    "🎮 GBR VIEWER",
    "⚡ GBR VIEWER",
    "📀 GBR VIEWER",
    "🕹️ GBR VIEWER"
];

let titleIndex = 0;

setInterval(() => {
    document.title = titleFrames[titleIndex % titleFrames.length];
    titleIndex++;
}, 1200);



fetch("https://countapi.mileshilliard.com/api/v1/hit/gbr-archiwum-blockchain")
    .then(r => r.json())
    .then(data => {
        const counterEl = document.getElementById("visitCounter");
        if(counterEl){
            counterEl.textContent = String(data.value).padStart(6, "0");
        }
    })
    .catch(() => {
        const counterEl = document.getElementById("visitCounter");
        if(counterEl) counterEl.textContent = "??????";
    });