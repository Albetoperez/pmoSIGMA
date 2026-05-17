function esc(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

var RESERVED = ['__proto__', 'constructor', 'prototype'];

var DOM_CACHE = {};
function $(id) {
    return DOM_CACHE[id] || (DOM_CACHE[id] = document.getElementById(id));
}

let tabActiva = 'global'; 
let miGrafico = null;
let ESTRUCTURA_DASH = {}, HISTORIAL = {}, acumulados = {};
let ultimoHastaFiltro = null;

window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    ESTRUCTURA_DASH = await localforage.getItem('PMO_ESTRUCTURA_FINAL') || {};
    HISTORIAL = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    
    const selector = document.getElementById('filtro-disc');
    const disciplinas = Object.keys(ESTRUCTURA_DASH);
    
    if (disciplinas.length === 0) {
        selector.innerHTML = '<option>No hay metas configuradas</option>';
    } else {
        selector.innerHTML = '<option value="__TODAS__">🚀 Todas las Disciplinas</option>' +
            disciplinas.map(function(d) {
                return '<option value="' + esc(d) + '">' + esc(d) + '</option>';
            }).join('');
    }
    
    actualizarSelectorItems();
    actualizarTodo();
};

function actualizarTodo() {
    procesarAcumulados();
    actualizarKPIs();
    renderTablaResumen();
    actualizarTabActual();
}

function cambiarDisciplina() {
    ultimoHastaFiltro = null;
    const disc = $('filtro-disc').value;
    if (disc === '__TODAS__') {
        $('wrapper-filtro-item').style.display = 'none';
        if (tabActiva !== 'global') cambiarTab('global');
    } else {
        actualizarSelectorItems();
    }
    actualizarTodo();
}

function setPresetFecha(preset) {
    const hoy = new Date().toISOString().split('T')[0];
    if (preset === 'todo') {
        $('fecha-desde').value = '';
        $('fecha-hasta').value = '';
    } else if (preset === 'semana') {
        const d = new Date(); d.setDate(d.getDate() - 6);
        $('fecha-desde').value = d.toISOString().split('T')[0];
        $('fecha-hasta').value = hoy;
    } else if (preset === 'mes') {
        const d = new Date(); d.setDate(d.getDate() - 29);
        $('fecha-desde').value = d.toISOString().split('T')[0];
        $('fecha-hasta').value = hoy;
    } else if (preset === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        $('fecha-desde').value = d.toISOString().split('T')[0];
        $('fecha-hasta').value = hoy;
    }
    actualizarTodo();
}

function actualizarSelectorItems() {
    const disc = document.getElementById('filtro-disc').value;
    const selectorItem = document.getElementById('filtro-item');
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];
    
    const opts = [];
    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        const grupos = ESTRUCTURA_DASH[d] || {};
        for (let g in grupos) {
            if (!grupos.hasOwnProperty(g)) continue;
            grupos[g].forEach(sub => {
                opts.push('<option value="' + esc(sub.item) + '">' + esc(d) + ' / ' + esc(g) + ' -> ' + esc(sub.item) + '</option>');
            });
        }
    }
    selectorItem.innerHTML = opts.length > 0 ? opts.join('') : '<option>No hay ítems</option>';
}

function cambiarTab(tab) {
    tabActiva = tab;
    $('tab-global').classList.remove('active');
    $('tab-fisico').classList.remove('active');
    $('tab-barras').classList.remove('active');
    $('tab-' + tab).classList.add('active');
    
    const disc = $('filtro-disc').value;
    const hideItemFilter = (disc === '__TODAS__');
    $('wrapper-filtro-item').style.display = (tab === 'fisico' && !hideItemFilter) ? 'flex' : 'none';
    actualizarTabActual();
}

function actualizarTabActual() {
    if (tabActiva === 'global') dibujarGraficoGlobal();
    else if (tabActiva === 'fisico') dibujarGraficoFisico();
    else if (tabActiva === 'barras') dibujarGraficoBarras();
}

function obtenerFechasOrdenadas() {
    let fechas = Object.keys(HISTORIAL);
    const desde = $('fecha-desde').value;
    const hasta = $('fecha-hasta').value;
    if (desde) fechas = fechas.filter(f => f >= desde);
    if (hasta) fechas = fechas.filter(f => f <= hasta);
    fechas.sort();
    return fechas;
}

function procesarAcumulados() {
    const hasta = $('fecha-hasta').value;
    if (hasta === ultimoHastaFiltro && Object.keys(acumulados).length > 0) return;
    ultimoHastaFiltro = hasta;
    acumulados = {};
    for (let f in HISTORIAL) {
        if (!HISTORIAL.hasOwnProperty(f)) continue;
        if (hasta && f > hasta) continue;
        for (let d in HISTORIAL[f]) {
            if (!HISTORIAL[f].hasOwnProperty(d)) continue;
            for (let g in HISTORIAL[f][d]) {
                if (!HISTORIAL[f][d].hasOwnProperty(g)) continue;
                HISTORIAL[f][d][g].forEach(item => {
                    acumulados[item.item] = (acumulados[item.item] || 0) + item.cantidad;
                });
            }
        }
    }
}

function actualizarKPIs() {
    const disc = $('filtro-disc').value;
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];

    let sumaMetas = 0, sumaProd = 0, completados = 0, totalItems = 0;

    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        const grupos = ESTRUCTURA_DASH[d] || {};
        for (let g in grupos) {
            if (!grupos.hasOwnProperty(g)) continue;
            grupos[g].forEach(sub => {
                totalItems++;
                const prod = acumulados[sub.item] || 0;
                sumaMetas += sub.meta; sumaProd += prod;
                if (prod >= sub.meta && sub.meta > 0) completados++;
            });
        }
    }

    const avance = sumaMetas > 0 ? Math.round((sumaProd / sumaMetas) * 100) : 0;
    $('kpi-avance').textContent = avance + '%';
    $('kpi-completados').textContent = completados + ' / ' + totalItems;
    $('kpi-total').textContent = Math.round(sumaProd).toLocaleString();

    // --- Velocidad Media (uds/día con datos) ---
    const fechas = obtenerFechasOrdenadas();
    const fechasConDatos = fechas.filter(f => {
        for (let d of disciplines) {
            if (HISTORIAL[f] && HISTORIAL[f][d]) return true;
        }
        return false;
    });
    const numDias = fechasConDatos.length;
    const velMedia = numDias > 0 ? Math.round(sumaProd / numDias) : 0;
    $('kpi-velocidad').textContent = velMedia > 0 ? velMedia.toLocaleString() + ' ud/día' : '—';

    // --- Días Restantes y Fecha Estimada ---
    const resto = Math.max(0, sumaMetas - sumaProd);
    const diasRest = velMedia > 0 ? Math.ceil(resto / velMedia) : null;
    if (diasRest !== null && diasRest < 3650) {
        const fechaEst = new Date();
        fechaEst.setDate(fechaEst.getDate() + diasRest);
        $('kpi-dias-rest').innerHTML = diasRest + 'd <span style="font-size:0.8rem;color:#888;">→ ' + fechaEst.toLocaleDateString() + '</span>';
    } else {
        $('kpi-dias-rest').textContent = '—';
    }

    // --- Progreso Semanal (variación en pp) ---
    const hoy = new Date().toISOString().split('T')[0];
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
    const hace7Str = hace7.toISOString().split('T')[0];
    let prodHace7 = 0;
    for (let f in HISTORIAL) {
        if (!HISTORIAL.hasOwnProperty(f)) continue;
        if (f > hace7Str) continue;
        for (let d of disciplines) {
            if (!HISTORIAL[f].hasOwnProperty(d)) continue;
            for (let g in HISTORIAL[f][d]) {
                if (!HISTORIAL[f][d].hasOwnProperty(g)) continue;
                HISTORIAL[f][d][g].forEach(item => { prodHace7 += item.cantidad; });
            }
        }
    }
    const pctHace7 = sumaMetas > 0 ? Math.round((prodHace7 / sumaMetas) * 100) : 0;
    const difSemanal = avance - pctHace7;
    const flecha = difSemanal > 0 ? '↑' : (difSemanal < 0 ? '↓' : '→');
    const colorDif = difSemanal > 0 ? '#16a34a' : (difSemanal < 0 ? '#dc2626' : '#888');
    $('kpi-progreso').innerHTML = (difSemanal >= 0 ? '+' : '') + difSemanal + 'pp <span style="color:' + colorDif + ';font-size:1.2rem;">' + flecha + '</span>';

    // --- SPI (Schedule Performance Index) ---
    if (fechas.length >= 2) {
        const fInicio = fechas[0];
        const fFin = fechas[fechas.length - 1];
        const diasTrans = Math.max(1, (new Date(fFin) - new Date(fInicio)) / (1000 * 60 * 60 * 24));
        const diasEstTotal = diasRest !== null ? diasTrans + diasRest : diasTrans;
        const pctTiempo = Math.min(100, Math.round((diasTrans / diasEstTotal) * 100)) || 1;
        const spi = (avance / pctTiempo);
        $('kpi-spi').textContent = spi.toFixed(2);
        $('kpi-spi').style.color = spi >= 1 ? '#16a34a' : (spi >= 0.8 ? '#eab308' : '#dc2626');
    } else {
        $('kpi-spi').textContent = '—';
        $('kpi-spi').style.color = '';
    }
}

function renderTablaResumen() {
    const disc = $('filtro-disc').value;
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];

    let rows = [];
    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        const grupos = ESTRUCTURA_DASH[d] || {};
        for (let g in grupos) {
            if (!grupos.hasOwnProperty(g)) continue;
            grupos[g].forEach(sub => {
                const prod = acumulados[sub.item] || 0;
                const pct = sub.meta > 0 ? Math.min(Math.round((prod / sub.meta) * 100), 100) : 0;
                rows.push({ disciplina: d, grupo: g, item: sub.item, meta: sub.meta, real: prod, pct: pct });
            });
        }
    }

    const cellStyle = 'padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:0.85rem;';
    $('tabla-resumen').innerHTML =
        '<div style="max-height:400px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#f8fafc;position:sticky;top:0;">' +
        '<th style="' + cellStyle + 'color:#475569;text-align:left;">Disciplina</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:left;">Grupo WBS</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:left;">Ítem</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:center;">Meta</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:center;">Real</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:center;">%</th>' +
        '<th style="' + cellStyle + 'color:#475569;text-align:center;">Estado</th>' +
        '</tr></thead><tbody>' +
        rows.map(r => {
            const color = r.pct >= 75 ? '#16a34a' : (r.pct >= 25 ? '#eab308' : '#dc2626');
            const etiqueta = r.pct >= 75 ? '🟢 On Track' : (r.pct >= 25 ? '🟡 Media' : '🔴 Crítico');
            return '<tr>' +
                '<td style="' + cellStyle + 'font-weight:bold;color:#005596;">' + esc(r.disciplina) + '</td>' +
                '<td style="' + cellStyle + '">' + esc(r.grupo) + '</td>' +
                '<td style="' + cellStyle + '">' + esc(r.item) + '</td>' +
                '<td style="' + cellStyle + 'text-align:center;font-weight:bold;">' + r.meta.toLocaleString() + '</td>' +
                '<td style="' + cellStyle + 'text-align:center;font-weight:bold;color:#ff9800;">' + Math.round(r.real).toLocaleString() + '</td>' +
                '<td style="' + cellStyle + 'text-align:center;font-weight:bold;">' + r.pct + '%</td>' +
                '<td style="' + cellStyle + 'text-align:center;background:' + color + '20;border-radius:4px;font-weight:bold;color:' + color + ';">' + etiqueta + '</td>' +
                '</tr>';
        }).join('') +
        '</tbody></table></div>';
}

// --- DIBUJADO DE GRÁFICOS ---
function dibujarGraficoGlobal() {
    const disc = $('filtro-disc').value;
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];

    const label = isAll ? 'TODAS LAS DISCIPLINAS' : disc;
    $('titulo-grafico').textContent = 'Curva S: Avance Temporal Progresivo (%) - ' + label;
    const fechas = obtenerFechasOrdenadas();

    let metaTotal = 0;
    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        const grupos = ESTRUCTURA_DASH[d] || {};
        for (let g in grupos) {
            if (!grupos.hasOwnProperty(g)) continue;
            grupos[g].forEach(sub => metaTotal += sub.meta);
        }
    }

    const histDates = Object.keys(HISTORIAL).filter(f => {
        for (let d of disciplines) {
            if (HISTORIAL[f] && HISTORIAL[f][d]) return true;
        }
        return false;
    }).sort();

    let datosProgreso = [];
    let runningSum = 0;
    let histIdx = 0;
    fechas.forEach(fechaMax => {
        while (histIdx < histDates.length && histDates[histIdx] <= fechaMax) {
            const f = histDates[histIdx];
            for (let d of disciplines) {
                if (!HISTORIAL[f] || !HISTORIAL[f][d]) continue;
                for (let g in HISTORIAL[f][d]) {
                    if (!HISTORIAL[f][d].hasOwnProperty(g)) continue;
                    HISTORIAL[f][d][g].forEach(i => runningSum += i.cantidad);
                }
            }
            histIdx++;
        }
        datosProgreso.push(metaTotal > 0 ? Math.round((runningSum / metaTotal) * 100) : 0);
    });
    if (fechas.length === 0) { fechas.push(new Date().toISOString().split('T')[0]); datosProgreso.push(0); }

    const ctx = $('chartMain').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'line',
        data: { labels: fechas, datasets: [{ label: '% Avance Real', data: datosProgreso, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 3, fill: true, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

function dibujarGraficoFisico() {
    const disc = $('filtro-disc').value;
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];
    const itemSelec = $('filtro-item').value;
    $('titulo-grafico').textContent = 'Curva S Física: ' + (isAll ? 'Todas' : disc) + ' → ' + itemSelec;
    const fechas = obtenerFechasOrdenadas();
    let metaItem = 0, unidadItem = '';
    
    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        for (let g in ESTRUCTURA_DASH[d]) {
            if (!ESTRUCTURA_DASH[d].hasOwnProperty(g)) continue;
            ESTRUCTURA_DASH[d][g].forEach(sub => { if (sub.item === itemSelec) { metaItem = sub.meta; unidadItem = sub.unidad; } });
        }
    }

    const histDates = Object.keys(HISTORIAL).filter(f => {
        for (let d of disciplines) {
            if (HISTORIAL[f] && HISTORIAL[f][d]) return true;
        }
        return false;
    }).sort();
    let datosProd = [], datosMeta = [];
    let runningSum = 0;
    let histIdx = 0;
    fechas.forEach(fechaMax => {
        while (histIdx < histDates.length && histDates[histIdx] <= fechaMax) {
            const f = histDates[histIdx];
            for (let d of disciplines) {
                if (!HISTORIAL[f] || !HISTORIAL[f][d]) continue;
                for (let g in HISTORIAL[f][d]) {
                    if (!HISTORIAL[f][d].hasOwnProperty(g)) continue;
                    HISTORIAL[f][d][g].forEach(i => { if (i.item === itemSelec) runningSum += i.cantidad; });
                }
            }
            histIdx++;
        }
        datosProd.push(runningSum); datosMeta.push(metaItem);
    });
    if (fechas.length === 0) { fechas.push(new Date().toISOString().split('T')[0]); datosProd.push(0); datosMeta.push(metaItem); }

    const ctx = $('chartMain').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'line',
        data: { labels: fechas, datasets: [
            { label: 'Producción Real (' + unidadItem + ')', data: datosProd, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.05)', borderWidth: 3, tension: 0.1 },
            { label: 'Meta Contractual', data: datosMeta, borderColor: '#005596', borderDash: [6,6], borderWidth: 2, fill: false }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function dibujarGraficoBarras() {
    const disc = $('filtro-disc').value;
    const isAll = disc === '__TODAS__';
    const disciplines = isAll ? Object.keys(ESTRUCTURA_DASH) : [disc];

    const label = isAll ? 'TODAS LAS DISCIPLINAS' : disc;
    $('titulo-grafico').textContent = 'Comparativo Barras - ' + label;
    let labels = [], metas = [], prods = [];
    for (let d of disciplines) {
        if (!ESTRUCTURA_DASH.hasOwnProperty(d)) continue;
        for (let g in ESTRUCTURA_DASH[d]) {
            if (!ESTRUCTURA_DASH[d].hasOwnProperty(g)) continue;
            ESTRUCTURA_DASH[d][g].forEach(sub => { labels.push(sub.item); metas.push(sub.meta); prods.push(acumulados[sub.item] || 0); });
        }
    }
    const ctx = $('chartMain').getContext('2d');
    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [
            { label: 'Real Acumulada', data: prods, backgroundColor: '#ff9800' },
            { label: 'Meta', data: metas, backgroundColor: '#d3e3f0' }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// === EXPORTACIÓN EXCEL COMPLETA Y CONSOLIDADA ===
function exportarExcelProf() {
    try {
        const desde = $('fecha-desde').value;
        const hasta = $('fecha-hasta').value;
        const libro = XLSX.utils.book_new();

        // PESTAÑA 1: RESUMEN CONSOLIDADO POR ÍTEMS
        let datosConsolidados = [];
        for (let disc in ESTRUCTURA_DASH) {
            if (!ESTRUCTURA_DASH.hasOwnProperty(disc)) continue;
            for (let grupo in ESTRUCTURA_DASH[disc]) {
                if (!ESTRUCTURA_DASH[disc].hasOwnProperty(grupo)) continue;
                ESTRUCTURA_DASH[disc][grupo].forEach(sub => {
                    const prodAcumulada = acumulados[sub.item] || 0;
                    let avanceFisico = sub.meta > 0 ? Math.round((prodAcumulada / sub.meta) * 100) : 0;
                    if (avanceFisico > 100) avanceFisico = 100;

                    datosConsolidados.push({
                        "Disciplina": disc,
                        "Grupo WBS": grupo,
                        "Ítem / Tarea": sub.item,
                        "Meta Contractual": sub.meta,
                        "Total Ejecutado Acumulado": Math.round(prodAcumulada),
                        "Unidad": sub.unidad,
                        "% Rendimiento": avanceFisico + "%"
                    });
                });
            }
        }

        if (datosConsolidados.length === 0) {
            alert("No hay datos cargados en el sistema.");
            return;
        }

        const hojaConsolidado = XLSX.utils.json_to_sheet(datosConsolidados);
        XLSX.utils.book_append_sheet(libro, hojaConsolidado, "Resumen Consolidado PMO");

        // PESTAÑA 2: HISTORIAL DETALLADO DE PARTES DIARIOS
        let datosCronologicos = [];
        for (let fecha in HISTORIAL) {
            if (!HISTORIAL.hasOwnProperty(fecha)) continue;
            if (desde && fecha < desde) continue;
            if (hasta && fecha > hasta) continue;
            for (let disc in HISTORIAL[fecha]) {
                if (!HISTORIAL[fecha].hasOwnProperty(disc)) continue;
                for (let grupo in HISTORIAL[fecha][disc]) {
                    if (!HISTORIAL[fecha][disc].hasOwnProperty(grupo)) continue;
                    HISTORIAL[fecha][disc][grupo].forEach(item => {
                        if (item.cantidad > 0) {
                            datosCronologicos.push({
                                "Fecha Reporte": fecha,
                                "Disciplina": disc,
                                "Grupo WBS": grupo,
                                "Ítem / Tarea": item.item,
                                "Cantidad Diario": item.cantidad,
                                "Ud.": item.unidad
                            });
                        }
                    });
                }
            }
        }

        if (datosCronologicos.length > 0) {
            datosCronologicos.sort((a, b) => a["Fecha Reporte"] < b["Fecha Reporte"] ? -1 : 1);
            const hojaPartes = XLSX.utils.json_to_sheet(datosCronologicos);
            XLSX.utils.book_append_sheet(libro, hojaPartes, "Historial Diario");
        }

        const sufijoFecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(libro, "Cuadro_Mando_SIGMA_PMO_" + sufijoFecha + ".xlsx");
    } catch (error) {
        alert("⚠️ Error crítico al generar el Excel: " + error.message);
    }
}

// === EXPORTACIÓN PDF RAPIDA VISTA ACTUAL ===
function exportarDashboardPDF() {
    const elemento = $('area-impresion-pdf');
    const disc = $('filtro-disc').value;
    const discLabel = (disc === '__TODAS__') ? 'Todas' : disc;
    const btns = document.querySelectorAll('.btn-export');
    const btn = btns.length > 1 ? btns[1] : btns[0];
    const textoOriginal = btn.textContent;
    btn.textContent = "⏳ Generando..."; btn.style.opacity = "0.7";
    var hoy = new Date().toISOString().split('T')[0];

    html2pdf().set({
        margin: 10, filename: 'Vista_Rapida_' + discLabel + '_' + hoy + '.pdf',
        image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(elemento).save().then(function() { btn.textContent = textoOriginal; btn.style.opacity = "1"; });
}

// === EXPORTACIÓN PDF INFORME COMPLETO TABULAR ===
function exportarInformeCompleto() {
    const btn = $('btn-pdf-full');
    const textoOriginal = btn.textContent;
    btn.textContent = "⏳ Generando..."; btn.style.opacity = "0.7"; btn.disabled = true;

    const desde = $('fecha-desde').value || 'Inicio del Proyecto';
    const hasta = $('fecha-hasta').value || 'Actualidad';

    const contenedorMemoria = document.createElement('div');
    contenedorMemoria.style.fontFamily = 'Arial, sans-serif';
    contenedorMemoria.style.color = '#333333';
    contenedorMemoria.style.padding = '20px';
    var hoy = new Date().toISOString().split('T')[0];

    var styleBlock = '<style>' +
        '.pdf-cell { padding: 10px; font-size: 0.85rem; }' +
        '.pdf-cell-bold { font-weight: bold; }' +
        '.pdf-cell-center { text-align: center; }' +
        '.pdf-cell-right { text-align: right; }' +
        '.pdf-tr { border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; }' +
        '.pdf-th { padding: 12px 10px; text-align: left; }' +
        '.pdf-th-center { padding: 12px 10px; text-align: center; }' +
        '.pdf-th-right { padding: 12px 10px; text-align: right; }' +
    '</style>';

    var headerHtml =
        '<div style="padding: 40px; text-align: center; border: 2px solid #005596; border-radius: 10px; margin-bottom: 30px; background: #ffffff;">' +
            '<div style="text-align: center; margin-bottom: 25px;">' +
                '<span style="font-family: \'Arial Black\', sans-serif; font-size: 2.3rem; font-weight: 900; color: #005596; letter-spacing: -1px;">ELECNOR</span>' +
                '<span style="font-family: Arial, sans-serif; font-size: 1.1rem; color: #ff9800; font-weight: bold; vertical-align: super; margin-left: 2px;">PMO</span>' +
            '</div>' +
            '<h1 style="color: #005596; font-size: 2.3rem; margin-bottom: 10px; font-weight: 900;">INFORME EJECUTIVO DE PRODUCCIÓN</h1>' +
            '<h2 style="color: #ff9800; font-size: 1.4rem; margin-top: 0; font-weight: bold;">DELEGACIÓN RENOVABLES, GAS Y AGUA</h2>' +
            '<hr style="border: 0; border-top: 3px solid #005596; width: 40%; margin: 30px auto;">' +
            '<div style="text-align: left; max-width: 500px; margin: 0 auto; font-size: 1.1rem; line-height: 2;">' +
                '<p><strong>Proyecto Contractual:</strong> SIGMA PMO - Elecnor</p>' +
                '<p><strong>Rango de Fechas Evaluado:</strong> Desde ' + esc(desde) + ' hasta ' + esc(hasta) + '</p>' +
                '<p><strong>Fecha de Emisión:</strong> ' + esc(new Date().toLocaleDateString()) + '</p>' +
            '</div>' +
        '</div>';

    var htmlHTML = styleBlock + headerHtml;

    var discKeys = Object.keys(ESTRUCTURA_DASH);
    for (var di = 0; di < discKeys.length; di++) {
        var disc = discKeys[di];
        var totalItems = 0, completados = 0, sumaMetas = 0, sumaProd = 0;
        var filasTabla = [];

        var esLogistica = (disc.toLowerCase() === 'logística' || disc.toLowerCase() === 'logistica');
        var columnaEstadoTexto = esLogistica ? 'Recibido' : 'Instalado';
        var kpiVolumenTexto = esLogistica ? 'VOLUMEN TOTAL RECIBIDO' : 'VOLUMEN TOTAL INSTALADO';

        for (var gg in ESTRUCTURA_DASH[disc]) {
            if (!ESTRUCTURA_DASH[disc].hasOwnProperty(gg)) continue;
            ESTRUCTURA_DASH[disc][gg].forEach(function(sub) {
                totalItems++;
                var prod = acumulados[sub.item] || 0;
                sumaMetas += sub.meta; 
                sumaProd += prod;
                
                if (prod >= sub.meta && sub.meta > 0) completados++;

                var porcentajeItem = sub.meta > 0 ? Math.round((prod / sub.meta) * 100) : 0;
                if (porcentajeItem > 100) porcentajeItem = 100;

                filasTabla.push(
                    '<tr class="pdf-tr">' +
                        '<td class="pdf-cell pdf-cell-bold" style="color: #4a5568;">' + esc(gg) + '</td>' +
                        '<td class="pdf-cell" style="color: #2d3748;">' + esc(sub.item) + '</td>' +
                        '<td class="pdf-cell pdf-cell-center pdf-cell-bold" style="color: #005596;">' + esc(sub.meta.toLocaleString()) + '</td>' +
                        '<td class="pdf-cell pdf-cell-center pdf-cell-bold" style="color: #ff9800;">' + esc(Math.round(prod).toLocaleString()) + '</td>' +
                        '<td class="pdf-cell pdf-cell-center" style="color: #718096;">' + esc(sub.unidad) + '</td>' +
                        '<td class="pdf-cell pdf-cell-right pdf-cell-bold" style="color: #1a202c;">' + porcentajeItem + '%</td>' +
                    '</tr>');
            });
        }

        var avanceDisc = sumaMetas > 0 ? Math.round((sumaProd / sumaMetas) * 100) : 0;

        htmlHTML +=
            '<div style="page-break-before: always; padding: 15px 10px;">' +
                '<h2 style="color: #005596; border-bottom: 3px solid #ff9800; padding-bottom: 8px; margin-bottom: 20px; font-size: 1.4rem; text-transform: uppercase;">▶ RESUMEN DE DISCIPLINA: ' + esc(disc) + '</h2>' +
                
                '<div style="display: flex; gap: 15px; margin-bottom: 25px;">' +
                    '<div style="flex: 1; background: #f7fafc; padding: 15px; border-radius: 6px; border-left: 5px solid #ff9800; text-align: center;">' +
                        '<span style="font-size: 0.8rem; color: #718096; font-weight: bold; display: block; margin-bottom: 5px;">AVANCE DE DISCIPLINA</span>' +
                        '<strong style="font-size: 1.8rem; color: #005596;">' + avanceDisc + '%</strong>' +
                    '</div>' +
                    '<div style="flex: 1; background: #f7fafc; padding: 15px; border-radius: 6px; border-left: 5px solid #005596; text-align: center;">' +
                        '<span style="font-size: 0.8rem; color: #718096; font-weight: bold; display: block; margin-bottom: 5px;">TAREAS COMPLETADAS</span>' +
                        '<strong style="font-size: 1.8rem; color: #005596;">' + completados + ' / ' + totalItems + '</strong>' +
                    '</div>' +
                    '<div style="flex: 1; background: #f7fafc; padding: 15px; border-radius: 6px; border-left: 5px solid #005596; text-align: center;">' +
                        '<span style="font-size: 0.8rem; color: #718096; font-weight: bold; display: block; margin-bottom: 5px;">' + esc(kpiVolumenTexto) + '</span>' +
                        '<strong style="font-size: 1.8rem; color: #005596;">' + esc(Math.round(sumaProd).toLocaleString()) + ' u.</strong>' +
                    '</div>' +
                '</div>' +

                '<table style="width: 100%; border-collapse: collapse; margin-top: 10px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">' +
                    '<thead>' +
                        '<tr style="background: #005596; color: #ffffff; text-align: left; font-size: 0.8rem; text-transform: uppercase;">' +
                            '<th class="pdf-th">Grupo WBS</th>' +
                            '<th class="pdf-th">Descripción de Tarea</th>' +
                            '<th class="pdf-th-center">Meta</th>' +
                            '<th class="pdf-th-center">' + esc(columnaEstadoTexto) + '</th>' +
                            '<th class="pdf-th-center">Ud</th>' +
                            '<th class="pdf-th-right">% Rend.</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' +
                        filasTabla.join('') +
                    '</tbody>' +
                '</table>' +
            '</div>';
    }

    contenedorMemoria.innerHTML = htmlHTML;

    var configuracionPDF = {
        margin:       [15, 15, 20, 15],
        filename:     'Informe_Ejecutivo_PMO_' + hoy + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(contenedorMemoria).set(configuracionPDF).toPdf().get('pdf').then(function(pdf) {
        var totalPaginas = pdf.internal.getNumberOfPages();
        for (var i = 1; i <= totalPaginas; i++) {
            pdf.setPage(i);
            pdf.setFont("Helvetica", "normal");
            pdf.setFontSize(9);
            pdf.setTextColor(113, 128, 150);
            pdf.text('Página ' + i + ' de ' + totalPaginas, pdf.internal.pageSize.getWidth() - 35, pdf.internal.pageSize.getHeight() - 10);
            pdf.text('SIGMA PMO - Elecnor', 15, pdf.internal.pageSize.getHeight() - 10);
        }
    }).save().then(function() {
        btn.textContent = textoOriginal; 
        btn.style.opacity = "1"; 
        btn.disabled = false;
    });
}