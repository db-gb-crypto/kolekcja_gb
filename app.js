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
    el.style.color = "#7a4d00"; // bursztynowa poświata "GB Light" po skopiowaniu

    setTimeout(() => {
        el.innerText = old;
        el.style.color = "";
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


// ===== DIAGRAM POWIĄZAŃ (SVG) =====
function budujDiagram(d, txid){
    const NS = "http://www.w3.org/2000/svg";
    const W = 170, H = 38, COL = 205, GAP = 12, PAD = 10;

    // 1. Drzewo powiązań (brakujące pola są pomijane)
    const n = (l, v, kids) => ({ l, v: v == null ? "?" : String(v), kids: kids || [] });
    const maybe = (l, v) => (v == null ? [] : [n(l, v)]);

    const ob = d.obudowa || {};
    const pcb = d.pcb || {};
    const rom = pcb.rom, mbc = pcb.mbc;

    const obudowa = n("OBUDOWA", ob.kod, [
        ...maybe("WYTŁOCZENIE", ob.kod_wytloczenia),
        ...maybe("PRZÓD", ob.kod_obudowy_przod),
        ...maybe("TYŁ", ob.kod_obudowy_tyl),
    ]);

    const pcbNode = n("PŁYTKA PCB", pcb.kod_pcb, [
        ...(rom ? [n("ROM", rom.rom_kod, [
            ...maybe("PRODUCENT", rom.rom_producent),
            ...maybe("DATA", rom.rom_data_int),
            ...maybe("SERIAL", rom.rom_data_serial),
        ])] : []),
        ...(mbc ? [n("MBC", mbc.mbc_kod, [
            ...maybe("DATA", mbc.mbc_data_int),
            ...maybe("SERIAL", mbc.mbc_data_serial),
        ])] : []),
    ]);

    const root = n("TXID", txid.slice(0, 8) + "…", [
        n("NR KOLEKCJI", d.id, [
            n("TYTUŁ", d.tytul, [obudowa, pcbNode]),
        ]),
    ]);

    // 2. Układ: x = głębokość, y = liście po kolei, rodzic wyśrodkowany
    let nextY = PAD, maxDepth = 0;
    (function place(node, depth){
        node.x = PAD + depth * COL;
        maxDepth = Math.max(maxDepth, depth);
        if(!node.kids.length){
            node.y = nextY;
            nextY += H + GAP;
        }else{
            node.kids.forEach(k => place(k, depth + 1));
            node.y = (node.kids[0].y + node.kids[node.kids.length - 1].y) / 2;
        }
    })(root, 0);

    const width = PAD * 2 + maxDepth * COL + W;
    const height = nextY + PAD - GAP;

    // 3. Rysowanie (textContent => bezpieczne dla XSS)
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.style.fontFamily = "monospace";

    const el = (tag, attrs, text) => {
        const e = document.createElementNS(NS, tag);
        for(const k in attrs) e.setAttribute(k, attrs[k]);
        if(text != null) e.textContent = text;
        svg.appendChild(e);
        return e;
    };

    (function edges(node){
        node.kids.forEach(k => {
            const x1 = node.x + W, y1 = node.y + H / 2;
            const x2 = k.x, y2 = k.y + H / 2, mx = (x1 + x2) / 2;
            el("path", {
                d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
                fill: "none", stroke: "#8bac0f", "stroke-width": 2
            });
            edges(k);
        });
    })(root);

    const cut = (s, max) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

    (function nodes(node){
        el("rect", { x: node.x, y: node.y, width: W, height: H, rx: 4,
                     fill: "#0f380f", stroke: "#9bbc0f", "stroke-width": 2 });
        el("text", { x: node.x + 8, y: node.y + 14, fill: "#8bac0f", "font-size": 10 }, node.l);
        el("text", { x: node.x + 8, y: node.y + 29, fill: "#9bbc0f", "font-size": 12,
                     "font-weight": "bold" }, cut(node.v, 22));
        node.kids.forEach(nodes);
    })(root);

    const wrap = document.createElement("div");
    wrap.className = "diagram-wrap";
    wrap.style.cssText = "overflow-x:auto;margin-top:15px;";
    const title = document.createElement("b");
    title.textContent = "DIAGRAM POWIĄZAŃ";
    wrap.appendChild(title);
    wrap.appendChild(svg);
    return wrap;
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
			out.appendChild(budujDiagram(found, txid));
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

// ===== OPIS GRY PO KLIKNIĘCIU (mgła + tekst) =====
function toggleGameDesc(card){
    card.classList.toggle("flipped");
}

// ===== FILTR WYSZUKIWANIA GIER =====
function filterGames(){
    const query = document.getElementById("gameSearch").value.toLowerCase();
    const cards = document.querySelectorAll("#gamesGrid .game-card[data-tytul]");

    cards.forEach(card => {
        const tytul = card.getAttribute("data-tytul");
        card.style.display = tytul.includes(query) ? "" : "none";
    });
}