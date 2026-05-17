function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

var RESERVED = ['__proto__', 'constructor', 'prototype'];

var ESTRUCTURA = {};
var disciplinaActiva = 'Logística';
var lineaBaseBloqueada = false;

window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    
    var saved = await localforage.getItem('PMO_ESTRUCTURA_FINAL');
    if (saved) {
        ESTRUCTURA = saved;
    } else {
        ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
    }
    
    lineaBaseBloqueada = await localforage.getItem('PMO_LINEABASE_BLOQUEADA') || false;
    
    initEventDelegation();
    
    if (window.location.hash === '#parte') abrirParte();
};

function initEventDelegation() {
    document.getElementById('sidebar-disc').addEventListener('click', function(e) {
        var btn = e.target.closest('.btn-sidebar');
        if (btn) cambiarDiscConfig(btn.dataset.disc);
    });

    document.getElementById('groups-area').addEventListener('click', function(e) {
        var t = e.target;
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

    document.getElementById('groups-area').addEventListener('change', function(e) {
        var t = e.target;
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
    });

    document.getElementById('tabs-parte').addEventListener('click', function(e) {
        var btn = e.target.closest('.tab');
        if (btn) cambiarDiscParte(btn.dataset.disc);
    });

    document.getElementById('parte-acordeones').addEventListener('change', function(e) {
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
    renderSidebar();
    renderGruposConfig();
}

function renderSidebar() {
    var nav = document.getElementById('sidebar-disc');
    nav.innerHTML = '<h3 style="margin:0 0 15px 0; color:var(--blue);">Disciplinas</h3>' +
        DISCIPLINAS.map(function(d) {
            return '<button class="btn-sidebar ' + (d === disciplinaActiva ? 'active' : '') + '" data-disc="' + esc(d) + '">' + esc(d) + '</button>';
        }).join('');
}

function cambiarDiscConfig(d) { 
    disciplinaActiva = d; 
    renderSidebar(); 
    renderGruposConfig(); 
}

function renderGruposConfig() {
    var area = document.getElementById('groups-area'); 
    area.innerHTML = '';
    var grupos = ESTRUCTURA[disciplinaActiva] || {};
    
    var btnLock = document.getElementById('btn-toggle-lock');
    if (lineaBaseBloqueada) {
        btnLock.innerText = '🔓 Desbloquear Línea Base';
        btnLock.classList.add('locked');
        document.getElementById('btn-show-add').classList.add('btn-disabled');
    } else {
        btnLock.innerText = '🔒 Congelar Línea Base';
        btnLock.classList.remove('locked');
        document.getElementById('btn-show-add').classList.remove('btn-disabled');
    }

    var disabledClass = lineaBaseBloqueada ? 'input-disabled' : '';
    var hiddenClass = lineaBaseBloqueada ? 'btn-disabled' : '';

    for (var gName in grupos) {
        var html = '<div class="group-container">\
            <div class="group-header">\
                <input type="text" value="' + esc(gName) + '" class="cfg-input-header ' + disabledClass + ' input-renombrar-grupo" data-grupo-original="' + esc(gName) + '" ' + (lineaBaseBloqueada ? 'readonly' : '') + '>\
                <button class="' + hiddenClass + ' btn-eliminar-grupo" style="color:red; background:none; border:none; cursor:pointer;" data-grupo="' + esc(gName) + '">🗑️</button>\
            </div>\
            <table class="config-table">\
                <thead>\
                    <tr><th>Sub-ítem</th><th style="text-align:center">Meta</th><th>Und</th><th class="' + hiddenClass + '"></th></tr>\
                </thead>\
                <tbody>';
        
        grupos[gName].forEach(function(sub, idx) {
            html += '<tr>\
                <td><input type="text" value="' + esc(sub.item) + '" class="cfg-input ' + disabledClass + ' input-sub-item" data-grupo="' + esc(gName) + '" data-idx="' + idx + '" ' + (lineaBaseBloqueada ? 'readonly' : '') + '></td>\
                <td><input type="number" min="0" value="' + sub.meta + '" class="cfg-input ' + disabledClass + ' input-sub-meta" style="text-align:center;" data-grupo="' + esc(gName) + '" data-idx="' + idx + '" ' + (lineaBaseBloqueada ? 'readonly' : '') + '></td>\
                <td><select class="cfg-input ' + disabledClass + ' select-sub-unidad" data-grupo="' + esc(gName) + '" data-idx="' + idx + '" ' + (lineaBaseBloqueada ? 'disabled' : '') + '>\
                    ' + UNIDADES.map(function(u) { return '<option value="' + esc(u) + '"' + (u === sub.unidad ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '\
                </select></td>\
                <td class="' + hiddenClass + '"><button style="border:none; background:none; color:red;" class="btn-eliminar-sub" data-grupo="' + esc(gName) + '" data-idx="' + idx + '">❌</button></td>\
            </tr>';
        });
        
        html += '</tbody></table>\
            <button class="btn-action-add ' + hiddenClass + ' btn-anadir-sub" style="background:#f9f9f9; width:100%; border:none; padding:10px; cursor:pointer;" data-grupo="' + esc(gName) + '">+ Añadir Ítem</button>\
        </div>';
        area.innerHTML += html;
    }
}

async function guardarConfig() {
    var btn = document.getElementById('btn-save-wbs');
    var textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
    try {
        await localforage.setItem('PMO_ESTRUCTURA_FINAL', ESTRUCTURA);
        alert('✅ Cambios guardados correctamente en la WBS.');
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
    var n = document.getElementById('new-group-name').value.trim();
    if (!n) {
        alert("El nombre del grupo no puede estar vacío.");
        return;
    }
    if (RESERVED.indexOf(n) !== -1 || n.startsWith('__')) {
        alert("⚠️ Error: Nombre de grupo no válido.");
        return;
    }
    ESTRUCTURA[disciplinaActiva][n] = []; 
    cancelarNuevoGrupo();
    renderGruposConfig(); 
}

function renombrarGrupo(o, n) {
    if (n && n !== o && !ESTRUCTURA[disciplinaActiva][n] && RESERVED.indexOf(n) === -1 && !n.startsWith('__')) {
        ESTRUCTURA[disciplinaActiva][n] = ESTRUCTURA[disciplinaActiva][o]; 
        delete ESTRUCTURA[disciplinaActiva][o]; 
    }
    renderGruposConfig(); 
}

function añadirSub(g) { 
    ESTRUCTURA[disciplinaActiva][g].push({item:'', meta:0, unidad:'uds'}); 
    renderGruposConfig(); 
}

function actualizarSub(g, i, k, v) { 
    if (k === 'meta') {
        var val = parseFloat(v);
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
    
    var f = document.getElementById('fecha-parte'); 
    if(!f.value) f.value = new Date().toISOString().split('T')[0];
    
    document.getElementById('tabs-parte').innerHTML = DISCIPLINAS.map(function(d) { 
        return '<button class="tab ' + (d === disciplinaActiva ? 'active' : '') + '" data-disc="' + esc(d) + '">' + esc(d) + '</button>';
    }).join('');
    
    renderAcordeones();
}

function cambiarDiscParte(d) { 
    disciplinaActiva = d; 
    abrirParte(); 
}

async function renderAcordeones() {
    var area = document.getElementById('parte-acordeones');
    area.innerHTML = '<div class="loading-spinner" style="margin:40px auto;">Cargando datos de producción...</div>';

    var fechaInput = document.getElementById('fecha-parte');
    if (!fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    var fecha = fechaInput.value;
    var grupos = ESTRUCTURA[disciplinaActiva] || {};

    try {
        var hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        var guardadosHoy = (hist[fecha] && hist[fecha][disciplinaActiva]) ? hist[fecha][disciplinaActiva] : null;

        var acumulados = {};
        for (var fKey in hist) {
            var dia = hist[fKey];
            if (dia[disciplinaActiva]) {
                for (var g in dia[disciplinaActiva]) {
                    if (!acumulados[g]) acumulados[g] = [];
                    dia[disciplinaActiva][g].forEach(function(sub, idx) {
                        acumulados[g][idx] = (acumulados[g][idx] || 0) + (sub.cantidad || 0);
                    });
                }
            }
        }

        var html = '';
        for (var gName in grupos) {
            html += '<div class="group-container"><div class="group-header">' + esc(gName) + '</div><table class="config-table"><tbody>';
            grupos[gName].forEach(function(sub, idx) {
                var valorHoy = (guardadosHoy && guardadosHoy[gName] && guardadosHoy[gName][idx]) ? (guardadosHoy[gName][idx].cantidad || 0) : 0;
                var totalAcumulado = acumulados[gName] ? (acumulados[gName][idx] || 0) : 0;
                var porcentaje = sub.meta > 0 ? Math.min((totalAcumulado / sub.meta) * 100, 100) : 0;
                var metaStr = Number.isInteger(sub.meta) ? sub.meta.toString() : sub.meta.toFixed(2);

                html += '<tr>\
                    <td style="width: 60%; padding-right: 10px;">\
                        <div style="font-weight: bold; color: #333; font-size: 0.9rem; margin-bottom: 8px;">' + esc(sub.item) + '</div>\
                        <div>\
                            <span class="badge badge-meta">Meta: ' + metaStr + ' ' + esc(sub.unidad) + '</span>\
                            <span class="badge badge-acum">Acum: ' + totalAcumulado.toLocaleString() + ' ' + esc(sub.unidad) + '</span>\
                        </div>\
                        <div class="progress-bar-bg">\
                            <div class="progress-bar-fill" style="width: ' + porcentaje + '%;"></div>\
                        </div>\
                    </td>\
                    <td style="vertical-align: middle; padding-left: 0;">\
                        <div class="badge-hoy">\
                            ' + (valorHoy > 0 ? '✔ Ya en sistema: <strong>' + valorHoy + '</strong>' : '<span style="color:#aaa;">Sin datos hoy</span>') + '\
                        </div>\
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">\
                            <span style="font-size: 0.8rem; color: #b45309; font-weight:bold;">+ Añadir:</span>\
                            <input type="number" id="prod-' + esc(gName) + '-' + idx + '" min="0" step="any" class="cfg-input input-add" style="width: 80px; text-align: right; font-weight: bold;" placeholder="0">\
                        </div>\
                    </td>\
                </tr>';
            });
            html += '</tbody></table></div>';
        }
        area.innerHTML = html || '<div class="empty-state">No hay ítems configurados en esta disciplina.</div>';
    } catch (e) {
        area.innerHTML = '<div class="error-message">⚠️ Error al cargar datos: ' + esc(e.message) + '</div>';
    }
}

function validarProduccionDiaria(input) {
    if (parseFloat(input.value) < 0) {
        alert("⚠️ Error: No se puede registrar producción negativa.");
        input.value = "";
    }
}

async function guardarParte() {
    var btn = document.querySelector('#view-parte .btn-save');
    var textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        var fecha = document.getElementById('fecha-parte').value;
        if (!fecha) {
            alert('⚠️ Selecciona una fecha antes de guardar.');
            btn.innerText = textoOriginal;
            btn.style.opacity = '1';
            btn.disabled = false;
            return;
        }

        var hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        
        if (!hist[fecha]) hist[fecha] = {};
        if (!hist[fecha][disciplinaActiva]) hist[fecha][disciplinaActiva] = {};

        var data = {};
        var hay = false;

        for (var g in ESTRUCTURA[disciplinaActiva]) {
            data[g] = ESTRUCTURA[disciplinaActiva][g].map(function(sub, i) {
                var input = document.getElementById('prod-' + esc(g) + '-' + i);
                var valorAgregado = input ? (parseFloat(input.value) || 0) : 0;
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
    
    var f = document.getElementById('fecha-historial');
    if(!f.value) f.value = new Date().toISOString().split('T')[0];
    
    renderListaHistorial();
}

async function renderListaHistorial() {
    var fecha = document.getElementById('fecha-historial').value;
    var hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    var dataDia = hist[fecha];
    var area = document.getElementById('historial-lista');
    
    if (!dataDia) {
        area.innerHTML = '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">No hay ningún parte de trabajo registrado en esta fecha.</div>';
        return;
    }
    
    var html = '';
    var hayDatosGlobal = false;

    for (var disc in dataDia) {
        var tieneDatos = false;
        var discHtml = '<div class="group-container" style="border-color: var(--blue);">\
            <div class="group-header" style="background: var(--blue); color: white;">⚙️ ' + esc(disc) + '</div>\
            <div style="background: white;">';
        
        for (var g in dataDia[disc]) {
            dataDia[disc][g].forEach(function(item) {
                if (item.cantidad > 0) {
                    tieneDatos = true;
                    hayDatosGlobal = true;
                    discHtml += '<div class="ticket-row">\
                        <div>\
                            <div class="ticket-title">' + esc(g) + '</div>\
                            <div class="ticket-sub">' + esc(item.item) + '</div>\
                        </div>\
                        <div class="ticket-val">' + item.cantidad + ' <span style="font-size:0.8rem; color:#888;">' + esc(item.unidad) + '</span></div>\
                    </div>';
                }
            });
        }
        discHtml += '</div></div>';
        if (tieneDatos) html += discHtml;
    }
    
    area.innerHTML = html || '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">Se guardó un parte, pero todas las cantidades están en cero.</div>';
}
