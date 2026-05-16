let ESTRUCTURA = {};
let disciplinaActiva = 'Logística';
let lineaBaseBloqueada = false;

window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    
    const saved = await localforage.getItem('PMO_ESTRUCTURA_FINAL');
    if (saved) {
        ESTRUCTURA = saved;
    } else {
        ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
    }
    
    lineaBaseBloqueada = await localforage.getItem('PMO_LINEABASE_BLOQUEADA') || false;
    
    if (window.location.hash === '#parte') abrirParte();
};

// === NAVEGACIÓN GENERAL ===
function irInicio() {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
    document.getElementById('view-portada').style.display = 'flex';
    document.getElementById('header-nav').style.display = 'none';
}

// === MÓDULO 1: CONFIGURACIÓN Y METAS (WBS) ===
function abrirConfig() {
    document.getElementById('view-portada').style.display = 'none';
    document.getElementById('view-config').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    renderSidebar();
    renderGruposConfig();
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-disc');
    nav.innerHTML = '<h3 style="margin:0 0 15px 0; color:var(--blue);">Disciplinas</h3>';
    DISCIPLINAS.forEach(d => {
        nav.innerHTML += `<button class="btn-sidebar ${d===disciplinaActiva?'active':''}" onclick="cambiarDiscConfig('${d}')">${d}</button>`;
    });
}

function cambiarDiscConfig(d) { 
    disciplinaActiva = d; 
    renderSidebar(); 
    renderGruposConfig(); 
}

function renderGruposConfig() {
    const area = document.getElementById('groups-area'); 
    area.innerHTML = '';
    const grupos = ESTRUCTURA[disciplinaActiva] || {};
    
    const btnLock = document.getElementById('btn-toggle-lock');
    if (lineaBaseBloqueada) {
        btnLock.innerText = '🔓 Desbloquear Línea Base';
        btnLock.classList.add('locked');
        document.getElementById('btn-show-add').classList.add('btn-disabled');
    } else {
        btnLock.innerText = '🔒 Congelar Línea Base';
        btnLock.classList.remove('locked');
        document.getElementById('btn-show-add').classList.remove('btn-disabled');
    }

    const disabledClass = lineaBaseBloqueada ? 'input-disabled' : '';
    const hiddenClass = lineaBaseBloqueada ? 'btn-disabled' : '';

    for (let gName in grupos) {
        let html = `<div class="group-container">
            <div class="group-header">
                <input type="text" value="${gName}" class="cfg-input-header ${disabledClass}" onchange="renombrarGrupo('${gName}', this.value)" ${lineaBaseBloqueada ? 'readonly' : ''}>
                <button class="${hiddenClass}" style="color:red; background:none; border:none; cursor:pointer;" onclick="eliminarGrupo('${gName}')">🗑️</button>
            </div>
            <table class="config-table">
                <thead>
                    <tr><th>Sub-ítem</th><th style="text-align:center">Meta</th><th>Und</th><th class="${hiddenClass}"></th></tr>
                </thead>
                <tbody>`;
        
        grupos[gName].forEach((sub, idx) => {
            html += `<tr>
                <td><input type="text" value="${sub.item}" class="cfg-input ${disabledClass}" onchange="actualizarSub('${gName}',${idx},'item',this.value)" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                <td><input type="number" min="0" value="${sub.meta}" class="cfg-input ${disabledClass}" style="text-align:center;" onchange="actualizarSub('${gName}',${idx},'meta',this.value)" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                <td><select class="cfg-input ${disabledClass}" onchange="actualizarSub('${gName}',${idx},'unidad',this.value)" ${lineaBaseBloqueada ? 'disabled' : ''}>
                    ${UNIDADES.map(u=>`<option value="${u}" ${u===sub.unidad?'selected':''}>${u}</option>`).join('')}
                </select></td>
                <td class="${hiddenClass}"><button style="border:none; background:none; color:red;" onclick="eliminarSub('${gName}',${idx})">❌</button></td>
            </tr>`;
        });
        
        html += `</tbody></table>
            <button class="btn-action-add ${hiddenClass}" style="background:#f9f9f9; width:100%; border:none; padding:10px; cursor:pointer;" onclick="añadirSub('${gName}')">+ Añadir Ítem</button>
        </div>`;
        area.innerHTML += html;
    }
}

async function toggleBloqueo() {
    lineaBaseBloqueada = !lineaBaseBloqueada;
    await localforage.setItem('PMO_LINEABASE_BLOQUEADA', lineaBaseBloqueada);
    renderGruposConfig();
    if(lineaBaseBloqueada) {
        alert("🔒 Línea base CONGELADA. No se pueden modificar las metas.");
    } else {
        alert("🔓 Línea base DESBLOQUEADA. Ya puedes editar el contrato.");
    }
}

function mostrarUIAdicionGrupo() {
    document.getElementById('add-group-ui').style.display = 'block';
    document.getElementById('btn-show-add').style.display = 'none';
    document.getElementById('new-group-name').focus();
}

function cancelarNuevoGrupo() {
    document.getElementById('add-group-ui').style.display = 'none';
    document.getElementById('btn-show-add').style.display = 'inline-block';
    document.getElementById('new-group-name').value = '';
}

function guardarNuevoGrupo() {
    let n = document.getElementById('new-group-name').value.trim();
    if (n) { 
        ESTRUCTURA[disciplinaActiva][n] = []; 
        cancelarNuevoGrupo();
        renderGruposConfig(); 
    } else {
        alert("El nombre del grupo no puede estar vacío.");
    }
}

function renombrarGrupo(o, n) { 
    if(n && !ESTRUCTURA[disciplinaActiva][n]) { 
        ESTRUCTURA[disciplinaActiva][n] = ESTRUCTURA[disciplinaActiva][o]; 
        delete ESTRUCTURA[disciplinaActiva][o]; 
        renderGruposConfig(); 
    } 
}

function añadirSub(g) { 
    ESTRUCTURA[disciplinaActiva][g].push({item:'', meta:0, unidad:'uds'}); 
    renderGruposConfig(); 
}

function actualizarSub(g, i, k, v) { 
    if (k === 'meta') {
        let val = parseFloat(v);
        if (val < 0 || isNaN(val)) {
            alert("⚠️ Error: No se admiten metas negativas.");
            renderGruposConfig();
            return;
        }
        ESTRUCTURA[disciplinaActiva][g][i][k] = val;
    } else {
        ESTRUCTURA[disciplinaActiva][g][i][k] = v;
    }
}

function eliminarGrupo(g) { 
    if(confirm("¿Estás seguro de eliminar todo el grupo y sus ítems?")) { 
        delete ESTRUCTURA[disciplinaActiva][g]; 
        renderGruposConfig(); 
    } 
}

// === MÓDULO 2: PARTE DIARIO DE PRODUCCIÓN ===
function abrirParte() {
    document.getElementById('view-portada').style.display = 'none';
    document.getElementById('view-parte').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const f = document.getElementById('fecha-parte'); 
    if(!f.value) f.value = new Date().toISOString().split('T')[0];
    
    document.getElementById('tabs-parte').innerHTML = DISCIPLINAS.map(d => 
        `<button class="tab ${d===disciplinaActiva?'active':''}" onclick="cambiarDiscParte('${d}')">${d}</button>`
    ).join('');
    
    renderAcordeones();
}

function cambiarDiscParte(d) { 
    disciplinaActiva = d; 
    abrirParte(); 
}

async function renderAcordeones() {
    const area = document.getElementById('parte-acordeones');
    const fechaInput = document.getElementById('fecha-parte');
    if (!fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    const fecha = fechaInput.value;
    const grupos = ESTRUCTURA[disciplinaActiva] || {};
    
    const hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    const guardadosHoy = (hist[fecha] && hist[fecha][disciplinaActiva]) ? hist[fecha][disciplinaActiva] : null;

    let acumulados = {};
    Object.values(hist).forEach(dia => {
        if (dia[disciplinaActiva]) {
            for (let g in dia[disciplinaActiva]) {
                if (!acumulados[g]) acumulados[g] = [];
                dia[disciplinaActiva][g].forEach((sub, idx) => {
                    acumulados[g][idx] = (acumulados[g][idx] || 0) + (sub.cantidad || 0);
                });
            }
        }
    });

    area.innerHTML = '';
    for (let gName in grupos) {
        let html = `<div class="group-container"><div class="group-header">${gName}</div><table class="config-table"><tbody>`;
        grupos[gName].forEach((sub, idx) => {
            // === CORRECCIÓN QUIRÚRGICA AQUÍ ===
            // Buscamos correctamente por el nombre del grupo y luego por la posición del ítem
            let valorHoy = guardadosHoy?.[gName]?.[idx]?.cantidad || 0;
            
            let totalAcumulado = acumulados[gName]?.[idx] || 0;
            let porcentaje = sub.meta > 0 ? Math.min((totalAcumulado / sub.meta) * 100, 100) : 0;

            html += `<tr>
                <td style="width: 60%; padding-right: 10px;">
                    <div style="font-weight: bold; color: #333; font-size: 0.9rem; margin-bottom: 8px;">${sub.item}</div>
                    <div>
                        <span class="badge badge-meta">Meta: ${sub.meta} ${sub.unidad}</span>
                        <span class="badge badge-acum">Acum: ${totalAcumulado} ${sub.unidad}</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #eee; border-radius: 3px; margin-top: 5px;">
                        <div style="width: ${porcentaje}%; height: 100%; background: #005596; border-radius: 3px;"></div>
                    </div>
                </td>
                <td style="vertical-align: middle; padding-left: 0;">
                    <div class="badge-hoy">
                        ${valorHoy > 0 ? `✔ Ya en sistema: <strong>${valorHoy}</strong>` : `<span style="color:#aaa;">Sin datos hoy</span>`}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                        <span style="font-size: 0.8rem; color: #b45309; font-weight:bold;">+ Añadir:</span>
                        <input type="number" id="prod-${gName}-${idx}" min="0" class="cfg-input input-add" style="width: 70px; text-align: right; font-weight: bold;" placeholder="0" onchange="validarProduccionDiaria(this)">
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        area.innerHTML += html;
    }
}

function validarProduccionDiaria(input) {
    if (parseFloat(input.value) < 0) {
        alert("⚠️ Error: No se puede registrar producción negativa.");
        input.value = "";
    }
}

async function guardarParte() {
    const fecha = document.getElementById('fecha-parte').value;
    let hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    
    if(!hist[fecha]) hist[fecha] = {};
    if(!hist[fecha][disciplinaActiva]) hist[fecha][disciplinaActiva] = {};

    let data = {}; 
    let hay = false;
    
    for (let g in ESTRUCTURA[disciplinaActiva]) {
        data[g] = ESTRUCTURA[disciplinaActiva][g].map((sub, i) => {
            let valorAgregado = parseFloat(document.getElementById(`prod-${g}-${i}`).value) || 0;
            if (valorAgregado < 0) valorAgregado = 0;
            
            let valorPrevio = 0;
            if (hist[fecha][disciplinaActiva] && hist[fecha][disciplinaActiva][g] && hist[fecha][disciplinaActiva][g][i]) {
                valorPrevio = hist[fecha][disciplinaActiva][g][i].cantidad;
            }
            
            let nuevoTotalDia = valorPrevio + valorAgregado;
            if(nuevoTotalDia > 0) hay = true;
            
            return { item: sub.item, cantidad: nuevoTotalDia, unidad: sub.unidad };
        });
    }
    
    hist[fecha][disciplinaActiva] = data;
    await localforage.setItem('PMO_HISTORIAL_PRODUCCION', hist);
    alert("✅ Producción añadida y sumada al total del día.");
    irInicio();
}

// === MÓDULO 3: VISOR DE HISTORIAL ===
function abrirHistorial() {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
    document.getElementById('view-historial').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const f = document.getElementById('fecha-historial');
    if(!f.value) f.value = new Date().toISOString().split('T')[0];
    
    renderListaHistorial();
}

async function renderListaHistorial() {
    const fecha = document.getElementById('fecha-historial').value;
    const hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    const dataDia = hist[fecha];
    const area = document.getElementById('historial-lista');
    
    if (!dataDia) {
        area.innerHTML = '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">No hay ningún parte de trabajo registrado en esta fecha.</div>';
        return;
    }
    
    let html = '';
    let hayDatosGlobal = false;

    for (let disc in dataDia) {
        let tieneDatos = false;
        let discHtml = `<div class="group-container" style="border-color: var(--blue);">
            <div class="group-header" style="background: var(--blue); color: white;">⚙️ ${disc}</div>
            <div style="background: white;">`;
        
        for (let g in dataDia[disc]) {
            dataDia[disc][g].forEach(item => {
                if (item.cantidad > 0) {
                    tieneDatos = true;
                    hayDatosGlobal = true;
                    discHtml += `<div class="ticket-row">
                        <div>
                            <div class="ticket-title">${g}</div>
                            <div class="ticket-sub">${item.item}</div>
                        </div>
                        <div class="ticket-val">${item.cantidad} <span style="font-size:0.8rem; color:#888;">${item.unidad}</span></div>
                    </div>`;
                }
            });
        }
        discHtml += `</div></div>`;
        if (tieneDatos) html += discHtml;
    }
    
    area.innerHTML = html || '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">Se guardó un parte, pero todas las cantidades están en cero.</div>';
}