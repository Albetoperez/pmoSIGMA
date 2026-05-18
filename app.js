// ==========================================================================
// SIGMA PMO - APLICACIÓN PRINCIPAL (app.js)
// ==========================================================================

function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const RESERVED = ['__proto__', 'constructor', 'prototype'];

let ESTRUCTURA = {};
let disciplinaActiva = 'Logística';
let lineaBaseBloqueada = false;
let tareaVinculoActiva = null; 

// === INICIALIZACIÓN ===
window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    
    const saved = await localforage.getItem('PMO_ESTRUCTURA_FINAL');
    if (saved) {
        ESTRUCTURA = saved;
    } else {
        ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
    }
    
    // Migración silenciosa: Transforma vínculos simples a múltiples (Arrays)
    for (let disc in ESTRUCTURA) {
        for (let grupo in ESTRUCTURA[disc]) {
            ESTRUCTURA[disc][grupo].forEach(item => {
                if (item.fechaInicio === undefined) item.fechaInicio = "";
                if (item.fechaFin === undefined) item.fechaFin = "";
                if (item.vinculos === undefined) {
                    item.vinculos = item.vinculo ? [item.vinculo] : [];
                    delete item.vinculo;
                }
            });
        }
    }
    
    lineaBaseBloqueada = await localforage.getItem('PMO_LINEABASE_BLOQUEADA') || false;
    
    inyectarModalVinculos();
    initEventDelegation();
    
    if (window.location.hash === '#parte') abrirParte();
};

function inyectarModalVinculos() {
    const modalHTML = `
    <div id="modal-vinculos" class="modal-overlay" style="display:none;">
        <div class="modal-content">
            <h3>Seleccionar Predecesoras</h3>
            <p style="font-size:0.85rem; color:#666; margin-top:0;">Selecciona las tareas que deben finalizar antes de iniciar esta.</p>
            <div id="lista-vinculos-checkbox" class="checkbox-list"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn-nav-outline" onclick="cerrarModalVinculos()">Cancelar</button>
                <button class="btn-action" onclick="guardarVinculosModal()">Guardar Vínculos</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function initEventDelegation() {
    document.getElementById('sidebar-disc').addEventListener('click', e => {
        const btn = e.target.closest('.btn-sidebar');
        if (btn) cambiarDiscConfig(btn.dataset.disc);
    });

    document.getElementById('groups-area').addEventListener('click', e => {
        const t = e.target;
        if (t.matches('.btn-eliminar-grupo')) {
            if (confirm("¿Estás seguro de eliminar todo el grupo y sus ítems?")) {
                eliminarGrupo(t.dataset.grupo);
            }
            return;
        }
        if (t.matches('.btn-eliminar-sub')) {
            eliminarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10));
            return;
        }
        if (t.matches('.btn-anadir-sub')) {
            añadirSub(t.dataset.grupo);
            return;
        }
    });

    document.getElementById('groups-area').addEventListener('change', e => {
        const t = e.target;
        if (t.matches('.input-renombrar-grupo')) {
            renombrarGrupo(t.dataset.grupoOriginal, t.value);
            return;
        }
        if (t.matches('.input-sub-item')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'item', t.value);
            return;
        }
        if (t.matches('.input-sub-meta')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'meta', t.value);
            return;
        }
        if (t.matches('.select-sub-unidad')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'unidad', t.value);
            return;
        }
        if (t.matches('.input-sub-fechaini')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'fechaInicio', t.value);
            return;
        }
        if (t.matches('.input-sub-fechafin')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'fechaFin', t.value);
            return;
        }
    });

    document.getElementById('tabs-parte').addEventListener('click', e => {
        const btn = e.target.closest('.tab');
        if (btn) cambiarDiscParte(btn.dataset.disc);
    });

    document.getElementById('parte-acordeones').addEventListener('change', e => {
        if (e.target.matches('.input-add')) {
            validarProduccionDiaria(e.target);
        }
    });
}

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
    
    const configHeader = document.querySelector('#view-config .main-content > div:first-child');
    configHeader.style.display = 'flex';
    configHeader.style.justifyContent = 'space-between';
    configHeader.style.flexWrap = 'wrap';
    configHeader.style.gap = '15px';
    
    configHeader.innerHTML = `
        <h2 style="margin: 0; color: var(--blue); border: none; padding: 0; min-width: 250px;">Configuración WBS</h2>
        <div class="header-actions">
            <button class="btn-header" onclick="descargarPlantillaWBS()">📥 Descargar Plantilla</button>
            <button class="btn-header" onclick="document.getElementById('file-import-wbs').click()">📤 Importar Excel</button>
            <input type="file" id="file-import-wbs" style="display:none;" accept=".xlsx, .xls" onchange="importarExcelWBS(this)">
            <button id="btn-toggle-lock" class="btn-header ${lineaBaseBloqueada ? 'locked' : 'unlocked'}" onclick="toggleBloqueo()">
                ${lineaBaseBloqueada ? '🔓 Desbloquear Línea Base' : '🔒 Congelar Línea Base'}
            </button>
        </div>
    `;
    
    renderSidebar();
    renderGruposConfig();
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-disc');
    let html = '<h3 style="margin:0 0 15px 0; color:var(--blue);">Disciplinas</h3>';
    html += DISCIPLINAS.map(d => {
        return `<button class="btn-sidebar ${d === disciplinaActiva ? 'active' : ''}" data-disc="${esc(d)}">${esc(d)}</button>`;
    }).join('');
    nav.innerHTML = html;
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

    const disabledClass = lineaBaseBloqueada ? 'input-disabled' : '';
    const hiddenClass = lineaBaseBloqueada ? 'btn-disabled' : '';

    for (let gName in grupos) {
        let html = `
        <div class="group-container">
            <div class="group-header">
                <input type="text" value="${esc(gName)}" class="cfg-input-header ${disabledClass} input-renombrar-grupo" data-grupo-original="${esc(gName)}" ${lineaBaseBloqueada ? 'readonly' : ''}>
                <button class="${hiddenClass} btn-eliminar-grupo" style="color:red; background:none; border:none; cursor:pointer;" data-grupo="${esc(gName)}">🗑️</button>
            </div>
            <div style="overflow-x: auto; padding: 0 10px;">
                <table class="config-table" style="min-width: 850px;">
                    <thead>
                        <tr>
                            <th style="width:25%">Sub-ítem</th>
                            <th style="width:10%; text-align:center">Meta</th>
                            <th style="width:10%">Und</th>
                            <th style="width:15%">F. Inicio</th>
                            <th style="width:15%">F. Fin</th>
                            <th style="width:20%; text-align:center;">Predecesoras</th>
                            <th class="${hiddenClass}" style="width:5%"></th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        grupos[gName].forEach((sub, idx) => {
            let numVinculos = Array.isArray(sub.vinculos) ? sub.vinculos.length : 0;
            let btnText = numVinculos > 0 ? `🔗 Vínculos (${numVinculos})` : '🔗 Vincular';
            let btnStyle = numVinculos > 0 ? 'background:#dbeafe; border-color:#3b82f6;' : '';
            
            const opcionesUnidad = UNIDADES.map(u => `<option value="${esc(u)}" ${u === sub.unidad ? 'selected' : ''}>${esc(u)}</option>`).join('');

            html += `
                        <tr>
                            <td><input type="text" value="${esc(sub.item)}" class="cfg-input ${disabledClass} input-sub-item" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td><input type="number" min="0" value="${sub.meta}" class="cfg-input ${disabledClass} input-sub-meta" style="text-align:center;" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td>
                                <select class="cfg-input ${disabledClass} select-sub-unidad" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'disabled' : ''}>
                                    ${opcionesUnidad}
                                </select>
                            </td>
                            <td><input type="date" value="${sub.fechaInicio || ''}" class="cfg-input ${disabledClass} input-sub-fechaini" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td><input type="date" value="${sub.fechaFin || ''}" class="cfg-input ${disabledClass} input-sub-fechafin" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td style="text-align:center;"><button class="btn-vinculos ${disabledClass}" style="${btnStyle}" onclick="abrirModalVinculos('${esc(gName)}', ${idx})" ${lineaBaseBloqueada ? 'disabled' : ''}>${btnText}</button></td>
                            <td class="${hiddenClass}"><button style="border:none; background:none; color:red;" class="btn-eliminar-sub" data-grupo="${esc(gName)}" data-idx="${idx}">❌</button></td>
                        </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <button class="btn-action-add ${hiddenClass} btn-anadir-sub" style="background:#f9f9f9; width:100%; border:none; padding:10px; cursor:pointer;" data-grupo="${esc(gName)}">+ Añadir Ítem</button>
        </div>`;
        area.innerHTML += html;
    }
}

// === LÓGICA DE VENTANA MODAL DE VÍNCULOS ===
function abrirModalVinculos(grupo, idx) {
    tareaVinculoActiva = { grupo: grupo, idx: idx };
    const tareaActual = ESTRUCTURA[disciplinaActiva][grupo][idx];
    const vinculosGuardados = Array.isArray(tareaActual.vinculos) ? tareaActual.vinculos : [];
    
    const listaContainer = document.getElementById('lista-vinculos-checkbox');
    let html = '';

    for (let d in ESTRUCTURA) {
        html += `<div style="background:#f1f5f9; padding:5px 10px; font-weight:bold; font-size:0.8rem; margin-top:10px; color:var(--blue);">${d}</div>`;
        for (let g in ESTRUCTURA[d]) {
            ESTRUCTURA[d][g].forEach(sub => {
                if (d === disciplinaActiva && g === grupo && sub.item === tareaActual.item) return;

                let idUnico = `${d}||${g}||${sub.item}`;
                let isChecked = vinculosGuardados.includes(idUnico) ? 'checked' : '';
                
                html += `
                <div class="checkbox-item">
                    <input type="checkbox" id="chk-${esc(idUnico)}" value="${esc(idUnico)}" class="chk-vinculo" ${isChecked}>
                    <label for="chk-${esc(idUnico)}"><strong>${esc(g)}</strong>: ${esc(sub.item)}</label>
                </div>`;
            });
        }
    }

    listaContainer.innerHTML = html;
    document.getElementById('modal-vinculos').style.display = 'flex';
}

function cerrarModalVinculos() {
    document.getElementById('modal-vinculos').style.display = 'none';
    tareaVinculoActiva = null;
}

function guardarVinculosModal() {
    if (!tareaVinculoActiva) return;
    
    let marcados = [];
    document.querySelectorAll('.chk-vinculo:checked').forEach(chk => {
        marcados.push(chk.value);
    });

    ESTRUCTURA[disciplinaActiva][tareaVinculoActiva.grupo][tareaVinculoActiva.idx].vinculos = marcados;
    
    cerrarModalVinculos();
    renderGruposConfig(); 
}

async function guardarConfig() {
    const btn = document.getElementById('btn-save-wbs');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
    try {
        await localforage.setItem('PMO_ESTRUCTURA_FINAL', ESTRUCTURA);
        alert('✅ Cambios guardados correctamente en la WBS y Fechas.');
    } catch (e) {
        alert('⚠️ Error al guardar la configuración: ' + e.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

async function toggleBloqueo() {
    lineaBaseBloqueada = !lineaBaseBloqueada;
    await localforage.setItem('PMO_LINEABASE_BLOQUEADA', lineaBaseBloqueada);
    
    const btn = document.getElementById('btn-toggle-lock');
    if (lineaBaseBloqueada) {
        btn.className = 'btn-header locked';
        btn.innerText = '🔓 Desbloquear Línea Base';
        alert("🔒 Línea base CONGELADA. Ya no se pueden modificar metas ni fechas.");
    } else {
        btn.className = 'btn-header unlocked';
        btn.innerText = '🔒 Congelar Línea Base';
        alert("🔓 Línea base DESBLOQUEADA. Puedes editar el contrato de nuevo.");
    }
    renderGruposConfig();
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
    const n = document.getElementById('new-group-name').value.trim();
    if (!n) {
        alert("El nombre del grupo no puede estar vacío.");
        return;
    }
    if (RESERVED.includes(n) || n.startsWith('__')) {
        alert("⚠️ Error: Nombre de grupo no válido.");
        return;
    }
    if (!ESTRUCTURA[disciplinaActiva]) ESTRUCTURA[disciplinaActiva] = {};
    if (!ESTRUCTURA[disciplinaActiva][n]) {
        ESTRUCTURA[disciplinaActiva][n] = []; 
    }
    cancelarNuevoGrupo();
    renderGruposConfig(); 
}

function renombrarGrupo(o, n) {
    if (n && n !== o && !ESTRUCTURA[disciplinaActiva][n] && !RESERVED.includes(n) && !n.startsWith('__')) {
        ESTRUCTURA[disciplinaActiva][n] = ESTRUCTURA[disciplinaActiva][o]; 
        delete ESTRUCTURA[disciplinaActiva][o]; 
    }
    renderGruposConfig(); 
}

function añadirSub(g) { 
    ESTRUCTURA[disciplinaActiva][g].push({item:'', meta:0, unidad:'uds', fechaInicio:'', fechaFin:'', vinculos:[]}); 
    renderGruposConfig(); 
}

function actualizarSub(g, i, k, v) { 
    if (k === 'meta') {
        const val = parseFloat(v);
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

function eliminarSub(g, i) {
     ESTRUCTURA[disciplinaActiva][g].splice(i, 1);
     renderGruposConfig();
}

function eliminarGrupo(g) { 
    if (confirm("¿Estás seguro de eliminar todo el grupo y sus ítems?")) { 
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
    if (!f.value) f.value = new Date().toISOString().split('T')[0];
    
    document.getElementById('tabs-parte').innerHTML = DISCIPLINAS.map(d => { 
        return `<button class="tab ${d === disciplinaActiva ? 'active' : ''}" data-disc="${esc(d)}">${esc(d)}</button>`;
    }).join('');
    
    renderAcordeones();
}

function cambiarDiscParte(d) { 
    disciplinaActiva = d; 
    abrirParte(); 
}

async function renderAcordeones() {
    const area = document.getElementById('parte-acordeones');
    area.innerHTML = '<div class="loading-spinner" style="margin:40px auto;">Cargando datos de producción...</div>';

    const fechaInput = document.getElementById('fecha-parte');
    if (!fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    const fecha = fechaInput.value;
    const grupos = ESTRUCTURA[disciplinaActiva] || {};

    try {
        const hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        const guardadosHoy = (hist[fecha] && hist[fecha][disciplinaActiva]) ? hist[fecha][disciplinaActiva] : null;

        let acumulados = {};
        for (let fKey in hist) {
            let dia = hist[fKey];
            if (dia[disciplinaActiva]) {
                for (let g in dia[disciplinaActiva]) {
                    if (!acumulados[g]) acumulados[g] = [];
                    dia[disciplinaActiva][g].forEach((sub, idx) => {
                        acumulados[g][idx] = (acumulados[g][idx] || 0) + (sub.cantidad || 0);
                    });
                }
            }
        }

        let html = '';
        for (let gName in grupos) {
            html += `<div class="group-container"><div class="group-header">${esc(gName)}</div><table class="config-table"><tbody>`;
            
            grupos[gName].forEach((sub, idx) => {
                const valorHoy = (guardadosHoy && guardadosHoy[gName] && guardadosHoy[gName][idx]) ? (guardadosHoy[gName][idx].cantidad || 0) : 0;
                const totalAcumulado = acumulados[gName] ? (acumulados[gName][idx] || 0) : 0;
                const porcentaje = sub.meta > 0 ? Math.min((totalAcumulado / sub.meta) * 100, 100) : 0;
                const metaStr = Number.isInteger(sub.meta) ? sub.meta.toString() : sub.meta.toFixed(2);

                html += `
                <tr>
                    <td style="width: 60%; padding-right: 10px;">
                        <div style="font-weight: bold; color: #333; font-size: 0.9rem; margin-bottom: 8px;">${esc(sub.item)}</div>
                        <div>
                            <span class="badge badge-meta">Meta: ${metaStr} ${esc(sub.unidad)}</span>
                            <span class="badge badge-acum">Acum: ${totalAcumulado.toLocaleString()} ${esc(sub.unidad)}</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${porcentaje}%;"></div>
                        </div>
                    </td>
                    <td style="vertical-align: middle; padding-left: 0;">
                        <div class="badge-hoy">
                            ${valorHoy > 0 ? `✔ Ya en sistema: <strong>${valorHoy}</strong>` : `<span style="color:#aaa;">Sin datos hoy</span>`}
                        </div>
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                            <span style="font-size: 0.8rem; color: #b45309; font-weight:bold;">+ Añadir:</span>
                            <input type="number" id="prod-${esc(gName)}-${idx}" min="0" step="any" class="cfg-input input-add" style="width: 80px; text-align: right; font-weight: bold;" placeholder="0">
                        </div>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
        area.innerHTML = html || '<div class="empty-state">No hay ítems configurados en esta disciplina.</div>';
    } catch (e) {
        area.innerHTML = `<div class="error-message">⚠️ Error al cargar datos: ${esc(e.message)}</div>`;
    }
}

function validarProduccionDiaria(input) {
    if (parseFloat(input.value) < 0) {
        alert("⚠️ Error: No se puede registrar producción negativa.");
        input.value = "";
    }
}

async function guardarParte() {
    const btn = document.querySelector('#view-parte .btn-save');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const fecha = document.getElementById('fecha-parte').value;
        if (!fecha) {
            alert('⚠️ Selecciona una fecha antes de guardar.');
            btn.innerText = textoOriginal;
            btn.style.opacity = '1';
            btn.disabled = false;
            return;
        }

        let hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        
        if (!hist[fecha]) hist[fecha] = {};
        if (!hist[fecha][disciplinaActiva]) hist[fecha][disciplinaActiva] = {};

        let data = {};
        let hay = false;

        for (let g in ESTRUCTURA[disciplinaActiva]) {
            data[g] = ESTRUCTURA[disciplinaActiva][g].map((sub, i) => {
                const input = document.getElementById(`prod-${esc(g)}-${i}`);
                let valorAgregado = input ? (parseFloat(input.value) || 0) : 0;
                if (valorAgregado < 0) valorAgregado = 0;
                if (valorAgregado > 0) hay = true;
                return { item: sub.item, cantidad: valorAgregado, unidad: sub.unidad };
            });
        }

        hist[fecha][disciplinaActiva] = data;
        await localforage.setItem('PMO_HISTORIAL_PRODUCCION', hist);
        alert("✅ Producción registrada correctamente.");
        irInicio();
    } catch (e) {
        alert("⚠️ Error al guardar la producción: " + e.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

// === MÓDULO 3: VISOR DE HISTORIAL ===
function abrirHistorial() {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
    document.getElementById('view-historial').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const f = document.getElementById('fecha-historial');
    if (!f.value) f.value = new Date().toISOString().split('T')[0];
    
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
        let discHtml = `
        <div class="group-container" style="border-color: var(--blue);">
            <div class="group-header" style="background: var(--blue); color: white;">⚙️ ${esc(disc)}</div>
            <div style="background: white;">`;
        
        for (let g in dataDia[disc]) {
            dataDia[disc][g].forEach(item => {
                if (item.cantidad > 0) {
                    tieneDatos = true;
                    hayDatosGlobal = true;
                    discHtml += `
                    <div class="ticket-row">
                        <div>
                            <div class="ticket-title">${esc(g)}</div>
                            <div class="ticket-sub">${esc(item.item)}</div>
                        </div>
                        <div class="ticket-val">${item.cantidad} <span style="font-size:0.8rem; color:#888;">${esc(item.unidad)}</span></div>
                    </div>`;
                }
            });
        }
        discHtml += `</div></div>`;
        if (tieneDatos) html += discHtml;
    }
    
    area.innerHTML = html || '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">Se guardó un parte, pero todas las cantidades están en cero.</div>';
}

// === MOTOR DE IMPORTACIÓN Y EXPORTACIÓN DE EXCEL PARA LA WBS ===

function cargarSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

async function descargarPlantillaWBS() {
    await cargarSheetJS();
    let data = [];
    
    for (let d in ESTRUCTURA) {
        for (let g in ESTRUCTURA[d]) {
            ESTRUCTURA[d][g].forEach(sub => {
                data.push({
                    "Disciplina": d,
                    "Grupo WBS": g,
                    "Sub-ítem / Tarea": sub.item,
                    "Meta": sub.meta || 0,
                    "Unidad": sub.unidad || "uds",
                    "Fecha Inicio (AAAA-MM-DD)": sub.fechaInicio || "",
                    "Fecha Fin (AAAA-MM-DD)": sub.fechaFin || ""
                });
            });
        }
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch: 20}, {wch: 25}, {wch: 35}, {wch: 12}, {wch: 10}, {wch: 22}, {wch: 22}];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contrato WBS");
    XLSX.writeFile(wb, "Plantilla_Maestro_WBS_ELECNOR.xlsx");
}

async function importarExcelWBS(input) {
    if (!input.files || input.files.length === 0) return;
    await cargarSheetJS();
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json.length === 0) {
                alert("⚠️ Error: El archivo Excel seleccionado está vacío.");
                input.value = "";
                return;
            }

            const primeraFila = json[0];
            if (!primeraFila.hasOwnProperty("Disciplina") || !primeraFila.hasOwnProperty("Grupo WBS") || !primeraFila.hasOwnProperty("Sub-ítem / Tarea")) {
                alert("⚠️ Formato incorrecto. El Excel debe contener obligatoriamente las columnas: 'Disciplina', 'Grupo WBS' y 'Sub-ítem / Tarea'.");
                input.value = "";
                return;
            }

            if (!confirm("⚠️ ATENCIÓN: Al importar este Excel se reescribirá la Línea Base con los datos del archivo. ¿Deseas continuar?")) {
                input.value = "";
                return;
            }

            let NUEVA_ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
            for (let d in NUEVA_ESTRUCTURA) {
                NUEVA_ESTRUCTURA[d] = {};
            }

            json.forEach(row => {
                const d = row["Disciplina"] ? row["Disciplina"].trim() : "";
                const g = row["Grupo WBS"] ? row["Grupo WBS"].trim() : "";
                const item = row["Sub-ítem / Tarea"] ? row["Sub-ítem / Tarea"].trim() : "";
                const meta = parseFloat(row["Meta"]) || 0;
                const unidad = row["Unidad"] ? row["Unidad"].trim() : "uds";
                const fIni = row["Fecha Inicio (AAAA-MM-DD)"] ? row["Fecha Inicio (AAAA-MM-DD)"].toString().trim() : "";
                const fFin = row["Fecha Fin (AAAA-MM-DD)"] ? row["Fecha Fin (AAAA-MM-DD)"].toString().trim() : "";

                if (!d || !g || !item) return; 

                if (!NUEVA_ESTRUCTURA[d]) NUEVA_ESTRUCTURA[d] = {};
                if (!NUEVA_ESTRUCTURA[d][g]) NUEVA_ESTRUCTURA[d][g] = [];

                NUEVA_ESTRUCTURA[d][g].push({
                    item: item,
                    meta: meta,
                    unidad: unidad,
                    fechaInicio: fIni,
                    fechaFin: fFin,
                    vinculos: [] 
                });
            });

            ESTRUCTURA = NUEVA_ESTRUCTURA;
            renderGruposConfig();
            alert("✅ Excel leído correctamente en pantalla. Pulsa el botón de abajo 'GUARDAR CAMBIOS EN WBS' para consolidarlo en el sistema.");
            
        } catch(err) {
            alert("⚠️ Error crítico procesando el archivo: " + err.message);
        }
        input.value = ""; 
    };
    reader.readAsArrayBuffer(file);
}