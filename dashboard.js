let tabActiva = 'global'; 
let miGrafico = null;
let ESTRUCTURA_DASH = {}, HISTORIAL = {}, acumulados = {};
let todasAcumulados = {};

window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    ESTRUCTURA_DASH = await localforage.getItem('PMO_ESTRUCTURA_FINAL') || {};
    HISTORIAL = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    
    const selector = document.getElementById('filtro-disc');
    const disciplinas = Object.keys(ESTRUCTURA_DASH);
    
    if (disciplinas.length === 0) {
        selector.innerHTML = '<option value="__TODAS__">🌐 Todas las disciplinas</option><option>No hay metas configuradas</option>';
    } else {
        const opts = ['<option value="__TODAS__">🌐 Todas las disciplinas</option>'];
        disciplinas.forEach(d => opts.push(`<option value="${d}">${d}</option>`));
        selector.innerHTML = opts.join('');
    }
    
    actualizarSelectorItems();
    actualizarTodo();
};

function actualizarTodo() {
    document.getElementById('kpi-avance').innerText = '...';
    document.getElementById('kpi-completados').innerText = '...';
    document.getElementById('kpi-total').innerText = '...';
    document.getElementById('kpi-velocidad').innerText = '—';
    document.getElementById('kpi-dias-restantes').innerText = '—';
    document.getElementById('kpi-riesgo').innerText = '—';
    document.getElementById('kpi-rendimiento').innerText = '—';
    mostrarCargaGrafico();
    procesarAcumulados();
    actualizarKPIs();
    dibujarTablaRAG();
    actualizarTabActual();
}

function cambiarDisciplina() { actualizarSelectorItems(); actualizarTodo(); }

function actualizarSelectorItems() {
    const disc = document.getElementById('filtro-disc').value;
    const selectorItem = document.getElementById('filtro-item');
    
    if (disc === '__TODAS__') {
        selectorItem.innerHTML = '<option value="">🌐 Vista global (todas las disciplinas)</option>';
        document.getElementById('wrapper-filtro-item').style.display = 'none';
        return;
    }
    
    const grupos = ESTRUCTURA_DASH[disc] || {};
    let opts = [], count = 0;
    for (let g in grupos) {
        grupos[g].forEach(sub => {
            opts.push(`<option value="${sub.item}">${g} -> ${sub.item}</option>`);
            count++;
        });
    }
    selectorItem.innerHTML = count > 0 ? opts.join('') : '<option>No hay ítems</option>';
}

function cambiarTab(tab) {
    tabActiva = tab;
    document.getElementById('tab-global').classList.remove('active');
    document.getElementById('tab-fisico').classList.remove('active');
    document.getElementById('tab-barras').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    document.getElementById('wrapper-filtro-item').style.display = (tab === 'fisico') ? 'flex' : 'none';
    actualizarTabActual();
}

function actualizarTabActual() {
    mostrarCargaGrafico();
    if (tabActiva === 'global') setTimeout(dibujarGraficoGlobal, 50);
    else if (tabActiva === 'fisico') setTimeout(dibujarGraficoFisico, 50);
    else if (tabActiva === 'barras') setTimeout(dibujarGraficoBarras, 50);
}

function obtenerFechasOrdenadas() {
    let fechas = Object.keys(HISTORIAL);
    const desde = document.getElementById('fecha-desde').value;
    const hasta = document.getElementById('fecha-hasta').value;
    if (desde) fechas = fechas.filter(f => f >= desde);
    if (hasta) fechas = fechas.filter(f => f <= hasta);
    fechas.sort((a, b) => new Date(a) - new Date(b));
    return fechas;
}

function procesarAcumulados() {
    acumulados = {};
    todasAcumulados = {};
    const hasta = document.getElementById('fecha-hasta').value;
    for (let f in HISTORIAL) {
        if (hasta && f > hasta) continue;
        for (let d in HISTORIAL[f]) {
            if (!todasAcumulados[d]) todasAcumulados[d] = {};
            for (let g in HISTORIAL[f][d]) {
                if (!todasAcumulados[d][g]) todasAcumulados[d][g] = {};
                HISTORIAL[f][d][g].forEach(item => {
                    acumulados[item.item] = (acumulados[item.item] || 0) + item.cantidad;
                    todasAcumulados[d][g][item.item] = (todasAcumulados[d][g][item.item] || 0) + item.cantidad;
                });
            }
        }
    }
}

function obtenerItemsADecorrer(disc) {
    if (disc === '__TODAS__') {
        let items = [];
        for (let d in ESTRUCTURA_DASH) {
            for (let g in ESTRUCTURA_DASH[d]) {
                ESTRUCTURA_DASH[d][g].forEach(sub => {
                    items.push({ disciplina: d, grupo: g, item: sub.item, meta: sub.meta, unidad: sub.unidad });
                });
            }
        }
        return items;
    }
    const grupos = ESTRUCTURA_DASH[disc] || {};
    let items = [];
    for (let g in grupos) {
        grupos[g].forEach(sub => {
            items.push({ disciplina: disc, grupo: g, item: sub.item, meta: sub.meta, unidad: sub.unidad });
        });
    }
    return items;
}

function obtenerDiasConProduccion() {
    const fechas = obtenerFechasOrdenadas();
    const disc = document.getElementById('filtro-disc').value;
    const diasActivos = [];
    for (let f of fechas) {
        if (!HISTORIAL[f]) continue;
        if (disc === '__TODAS__') {
            let anyProd = false;
            for (let d in HISTORIAL[f]) {
                for (let g in HISTORIAL[f][d]) {
                    HISTORIAL[f][d][g].forEach(i => { if (i.cantidad > 0) anyProd = true; });
                }
            }
            if (anyProd) diasActivos.push(f);
        } else if (HISTORIAL[f][disc]) {
            let anyProd = false;
            for (let g in HISTORIAL[f][disc]) {
                HISTORIAL[f][disc][g].forEach(i => { if (i.cantidad > 0) anyProd = true; });
            }
            if (anyProd) diasActivos.push(f);
        }
    }
    return diasActivos;
}

function actualizarKPIs() {
    const disc = document.getElementById('filtro-disc').value;
    const items = obtenerItemsADecorrer(disc);
    let sumaMetas = 0, sumaProd = 0, completados = 0, totalItems = items.length;

    for (let sub of items) {
        const prod = acumulados[sub.item] || 0;
        sumaMetas += sub.meta; sumaProd += prod;
        if (prod >= sub.meta && sub.meta > 0) completados++;
    }

    const avancePct = sumaMetas > 0 ? (sumaProd / sumaMetas) * 100 : 0;
    document.getElementById('kpi-avance').innerText = avancePct < 1 && avancePct > 0 ? avancePct.toFixed(2) + '%' : Math.round(avancePct) + '%';
    document.getElementById('kpi-completados').innerText = `${completados} / ${totalItems}`;
    document.getElementById('kpi-total').innerText = sumaProd < 1 && sumaProd > 0 ? sumaProd.toFixed(2) : Math.round(sumaProd).toLocaleString();

    // Predictive KPIs
    const diasActivos = obtenerDiasConProduccion();
    const numDias = diasActivos.length;
    const velocidad = numDias > 0 ? sumaMetas > 0 ? sumaProd / numDias : 0 : 0;
    const restante = sumaMetas - sumaProd;
    const diasRestantes = velocidad > 0 ? Math.ceil(restante / velocidad) : null;

    // Calculate expected progress based on time elapsed
    const fechasOrdenadas = obtenerFechasOrdenadas();
    let pctTiempoTranscurrido = 0;
    if (fechasOrdenadas.length >= 2) {
        const inicio = new Date(fechasOrdenadas[0]);
        const fin = new Date(fechasOrdenadas[fechasOrdenadas.length - 1]);
        const hoy = new Date();
        const totalDuracion = fin - inicio;
        if (totalDuracion > 0) {
            pctTiempoTranscurrido = Math.min(1, Math.max(0, (hoy - inicio) / totalDuracion));
        }
    }
    const esperadoPct = pctTiempoTranscurrido * 100;
    const realPct = avancePct;

    // Velocity KPI
    if (velocidad > 0) {
        const v = velocidad < 1 ? velocidad.toFixed(2) : Math.round(velocidad).toLocaleString();
        document.getElementById('kpi-velocidad').innerText = `${v} ud/día`;
    } else {
        document.getElementById('kpi-velocidad').innerText = '—';
    }

    // Remaining days
    if (diasRestantes !== null && diasRestantes >= 0 && diasRestantes < 9999) {
        document.getElementById('kpi-dias-restantes').innerText = `${diasRestantes} días`;
        if (diasRestantes <= 7) document.getElementById('kpi-dias-restantes').style.color = '#dc2626';
        else if (diasRestantes <= 30) document.getElementById('kpi-dias-restantes').style.color = '#ff9800';
        else document.getElementById('kpi-dias-restantes').style.color = 'var(--blue)';
    } else {
        document.getElementById('kpi-dias-restantes').innerText = restante <= 0 ? '✅ Completo' : '—';
        document.getElementById('kpi-dias-restantes').style.color = restante <= 0 ? '#16a34a' : 'var(--blue)';
    }

    // Risk KPI
    const diff = realPct - esperadoPct;
    let riesgoTexto, riesgoColor;
    if (totalItems === 0) {
        riesgoTexto = '—'; riesgoColor = '#888';
    } else if (realPct >= 100) {
        riesgoTexto = '✅ Completo'; riesgoColor = '#16a34a';
    } else if (diff >= 5) {
        riesgoTexto = '🟢 Bajo'; riesgoColor = '#16a34a';
    } else if (diff >= -10) {
        riesgoTexto = '🟡 Medio'; riesgoColor = '#ff9800';
    } else {
        riesgoTexto = '🔴 Alto'; riesgoColor = '#dc2626';
    }
    document.getElementById('kpi-riesgo').innerText = riesgoTexto;
    document.getElementById('kpi-riesgo').style.color = riesgoColor;

    // Rendimiento KPI
    if (esperadoPct > 0 && totalItems > 0) {
        const rendimiento = (realPct / esperadoPct) * 100;
        const rendTexto = Math.round(rendimiento) + '%';
        document.getElementById('kpi-rendimiento').innerText = rendTexto;
        if (rendimiento >= 95) document.getElementById('kpi-rendimiento').style.color = '#16a34a';
        else if (rendimiento >= 70) document.getElementById('kpi-rendimiento').style.color = '#ff9800';
        else document.getElementById('kpi-rendimiento').style.color = '#dc2626';
    } else if (totalItems > 0 && fechasOrdenadas.length < 2) {
        document.getElementById('kpi-rendimiento').innerText = 'Pocos datos';
        document.getElementById('kpi-rendimiento').style.color = '#888';
    } else {
        document.getElementById('kpi-rendimiento').innerText = '—';
        document.getElementById('kpi-rendimiento').style.color = '#888';
    }
}

// --- DIBUJADO DE GRÁFICOS ---
function mostrarCargaGrafico() {
    document.getElementById('titulo-grafico').innerText = '⏳ Cargando gráfico...';
}

function obtenerMetaTotalDisc(disc) {
    let total = 0;
    if (disc === '__TODAS__') {
        for (let d in ESTRUCTURA_DASH) {
            for (let g in ESTRUCTURA_DASH[d]) ESTRUCTURA_DASH[d][g].forEach(sub => total += sub.meta);
        }
    } else {
        for (let g in (ESTRUCTURA_DASH[disc] || {})) ESTRUCTURA_DASH[disc][g].forEach(sub => total += sub.meta);
    }
    return total;
}

function dibujarGraficoGlobal() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        const fechas = obtenerFechasOrdenadas();
        const metaTotalDisc = obtenerMetaTotalDisc(disc);

        let datosProgreso = [], prodAcum = 0;
        fechas.forEach(f => {
            if (HISTORIAL[f]) {
                if (disc === '__TODAS__') {
                    for (let d in HISTORIAL[f]) {
                        for (let g in HISTORIAL[f][d]) HISTORIAL[f][d][g].forEach(i => prodAcum += i.cantidad);
                    }
                } else if (HISTORIAL[f][disc]) {
                    for (let g in HISTORIAL[f][disc]) HISTORIAL[f][disc][g].forEach(i => prodAcum += i.cantidad);
                }
            }
            datosProgreso.push(metaTotalDisc > 0 ? Math.round((prodAcum / metaTotalDisc) * 100) : 0);
        });

        if (fechas.length === 0) { fechas.push(new Date().toISOString().split('T')[0]); datosProgreso.push(0); }

        const discLabel = disc === '__TODAS__' ? 'Todas las disciplinas' : disc;
        document.getElementById('titulo-grafico').innerText = `Curva S: Avance Temporal Progresivo (%) - ${discLabel}`;

        const ctx = document.getElementById('chartMain').getContext('2d');
        if (miGrafico) miGrafico.destroy();
        miGrafico = new Chart(ctx, {
            type: 'line',
            data: { labels: fechas, datasets: [{ label: '% Avance Real', data: datosProgreso, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 3, fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
        });
    } catch (e) {
        document.getElementById('titulo-grafico').innerText = '⚠️ Error al generar el gráfico';
        console.error('Error en dibujarGraficoGlobal:', e);
    }
}

function dibujarGraficoFisico() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        const itemSelec = document.getElementById('filtro-item').value;
        const fechas = obtenerFechasOrdenadas();
        let metaItem = 0, unidadItem = '';

        if (disc === '__TODAS__') {
            document.getElementById('titulo-grafico').innerText = 'Selecciona una disciplina específica para ver Curva S Física';
            return;
        }

        for (let g in ESTRUCTURA_DASH[disc]) {
            ESTRUCTURA_DASH[disc][g].forEach(sub => { if (sub.item === itemSelec) { metaItem = sub.meta; unidadItem = sub.unidad; } });
        }

        let datosProd = [], datosMeta = [], prodAcum = 0;
        fechas.forEach(f => {
            if (HISTORIAL[f] && HISTORIAL[f][disc]) {
                for (let g in HISTORIAL[f][disc]) {
                    HISTORIAL[f][disc][g].forEach(i => { if (i.item === itemSelec) prodAcum += i.cantidad; });
                }
            }
            datosProd.push(prodAcum); datosMeta.push(metaItem);
        });

        if (fechas.length === 0) { fechas.push(new Date().toISOString().split('T')[0]); datosProd.push(0); datosMeta.push(metaItem); }

        document.getElementById('titulo-grafico').innerText = `Curva S Física: ${itemSelec}`;

        const ctx = document.getElementById('chartMain').getContext('2d');
        if (miGrafico) miGrafico.destroy();
        miGrafico = new Chart(ctx, {
            type: 'line',
            data: { labels: fechas, datasets: [
                { label: `Producción Real (${unidadItem})`, data: datosProd, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.05)', borderWidth: 3, tension: 0.1 },
                { label: `Meta Contractual`, data: datosMeta, borderColor: '#005596', borderDash: [6,6], borderWidth: 2, fill: false }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) {
        document.getElementById('titulo-grafico').innerText = '⚠️ Error al generar el gráfico';
        console.error('Error en dibujarGraficoFisico:', e);
    }
}

function dibujarGraficoBarras() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        const discLabel = disc === '__TODAS__' ? 'Todas las disciplinas' : disc;
        document.getElementById('titulo-grafico').innerText = `Comparativo Barras - ${discLabel}`;
        let labels = [], metas = [], prods = [];

        if (disc === '__TODAS__') {
            for (let d in ESTRUCTURA_DASH) {
                let sumaMeta = 0, sumaProd = 0;
                for (let g in ESTRUCTURA_DASH[d]) {
                    ESTRUCTURA_DASH[d][g].forEach(sub => {
                        sumaMeta += sub.meta;
                        sumaProd += acumulados[sub.item] || 0;
                    });
                }
                labels.push(d);
                metas.push(sumaMeta);
                prods.push(sumaProd);
            }
        } else {
            for (let g in ESTRUCTURA_DASH[disc]) {
                ESTRUCTURA_DASH[disc][g].forEach(sub => {
                    labels.push(`${sub.item}`);
                    metas.push(sub.meta);
                    prods.push(acumulados[sub.item] || 0);
                });
            }
        }

        const ctx = document.getElementById('chartMain').getContext('2d');
        if (miGrafico) miGrafico.destroy();
        miGrafico = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [
                { label: 'Real Acumulada', data: prods, backgroundColor: '#ff9800' },
                { label: 'Meta', data: metas, backgroundColor: '#d3e3f0' }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) {
        document.getElementById('titulo-grafico').innerText = '⚠️ Error al generar el gráfico';
        console.error('Error en dibujarGraficoBarras:', e);
    }
}

// === FUNCIONES DE FILTRO RÁPIDO Y TABLA RAG ===
function aplicarFiltroRapido(rango) {
    document.querySelectorAll('.btn-quick-filter').forEach(b => b.classList.remove('active'));
    document.querySelector(`.btn-quick-filter[data-range="${rango}"]`).classList.add('active');

    const hoy = new Date();
    const fmt = d => d.toISOString().split('T')[0];

    if (rango === 'todo') {
        document.getElementById('fecha-desde').value = '';
        document.getElementById('fecha-hasta').value = '';
    } else {
        const dias = parseInt(rango, 10);
        const desde = new Date(hoy);
        desde.setDate(hoy.getDate() - dias);
        document.getElementById('fecha-desde').value = fmt(desde);
        document.getElementById('fecha-hasta').value = fmt(hoy);
    }
    actualizarTodo();
}

function obtenerColorRAG(pct) {
    if (pct >= 80) return { color: '#16a34a', bg: '#dcfce7', label: '🟢 Bueno' };
    if (pct >= 50) return { color: '#ff9800', bg: '#fff3e0', label: '🟡 Alerta' };
    return { color: '#dc2626', bg: '#fef2f2', label: '🔴 Crítico' };
}

function dibujarTablaRAG() {
    const tbody = document.getElementById('rag-tbody');
    const fechaRef = document.getElementById('rag-fecha-ref');
    const disc = document.getElementById('filtro-disc').value;
    const hoy = new Date().toLocaleDateString();
    fechaRef.innerText = `Actualizado: ${hoy}`;

    let filas = [];
    let totalMeta = 0, totalProd = 0, totalItems = 0, totalComp = 0;

    if (disc === '__TODAS__') {
        for (let d in ESTRUCTURA_DASH) {
            let discMeta = 0, discProd = 0, discItems = 0, discComp = 0;
            for (let g in ESTRUCTURA_DASH[d]) {
                ESTRUCTURA_DASH[d][g].forEach(sub => {
                    discItems++;
                    const prod = acumulados[sub.item] || 0;
                    discMeta += sub.meta;
                    discProd += prod;
                    if (prod >= sub.meta && sub.meta > 0) discComp++;
                });
            }
            const pct = discMeta > 0 ? Math.round((discProd / discMeta) * 100) : 0;
            const rag = obtenerColorRAG(pct);
            filas.push({
                nombre: d, esDisc: true,
                items: discItems, comp: discComp,
                meta: discMeta, prod: discProd,
                pct: Math.min(pct, 100), rag: rag
            });
            totalMeta += discMeta; totalProd += discProd;
            totalItems += discItems; totalComp += discComp;
        }
    } else {
        const grupos = ESTRUCTURA_DASH[disc] || {};
        for (let g in grupos) {
            let gMeta = 0, gProd = 0, gItems = 0, gComp = 0;
            grupos[g].forEach(sub => {
                gItems++;
                const prod = acumulados[sub.item] || 0;
                gMeta += sub.meta;
                gProd += prod;
                if (prod >= sub.meta && sub.meta > 0) gComp++;
            });
            const pct = gMeta > 0 ? Math.round((gProd / gMeta) * 100) : 0;
            const rag = obtenerColorRAG(pct);
            filas.push({
                nombre: g, esDisc: false,
                items: gItems, comp: gComp,
                meta: gMeta, prod: gProd,
                pct: Math.min(pct, 100), rag: rag
            });
            totalMeta += gMeta; totalProd += gProd;
            totalItems += gItems; totalComp += gComp;
        }
    }

    let html = '';
    for (let f of filas) {
        const prefix = f.esDisc ? '📁 ' : '  └ ';
        html += `<tr>
            <td style="font-weight: ${f.esDisc ? 'bold' : 'normal'};">${prefix} ${f.nombre}</td>
            <td>${f.items}</td>
            <td>${f.comp}</td>
            <td>${Math.round(f.meta).toLocaleString()}</td>
            <td>${Math.round(f.prod).toLocaleString()}</td>
            <td style="font-weight: bold;">${f.pct}%</td>
            <td><span class="rag-badge" style="background: ${f.rag.bg}; color: ${f.rag.color}; border: 1px solid ${f.rag.color};">${f.rag.label}</span></td>
        </tr>`;
    }

    if (filas.length > 1) {
        const totalPct = totalMeta > 0 ? Math.round((totalProd / totalMeta) * 100) : 0;
        const totalRag = obtenerColorRAG(totalPct);
        html += `<tr class="rag-total-row">
            <td style="font-weight: 900;">📊 TOTAL</td>
            <td>${totalItems}</td>
            <td>${totalComp}</td>
            <td>${Math.round(totalMeta).toLocaleString()}</td>
            <td>${Math.round(totalProd).toLocaleString()}</td>
            <td style="font-weight: 900;">${Math.min(totalPct, 100)}%</td>
            <td><span class="rag-badge" style="background: ${totalRag.bg}; color: ${totalRag.color}; border: 1px solid ${totalRag.color};">${totalRag.label}</span></td>
        </tr>`;
    }

    tbody.innerHTML = filas.length > 0 ? html : '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">No hay datos disponibles</td></tr>';
}

// === EXPORTACIÓN EXCEL COMPLETA Y CONSOLIDADA ===
function exportarExcelProf() {
    try {
        const desde = document.getElementById('fecha-desde').value;
        const hasta = document.getElementById('fecha-hasta').value;
        const libro = XLSX.utils.book_new();

        // PESTAÑA 1: RESUMEN CONSOLIDADO POR ÍTEMS
        let datosConsolidados = [];
        for (let disc in ESTRUCTURA_DASH) {
            for (let grupo in ESTRUCTURA_DASH[disc]) {
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
            if (desde && fecha < desde) continue;
            if (hasta && fecha > hasta) continue;
            for (let disc in HISTORIAL[fecha]) {
                for (let grupo in HISTORIAL[fecha][disc]) {
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
            datosCronologicos.sort((a, b) => new Date(a["Fecha Reporte"]) - new Date(b["Fecha Reporte"]));
            const hojaPartes = XLSX.utils.json_to_sheet(datosCronologicos);
            XLSX.utils.book_append_sheet(libro, hojaPartes, "Historial Diario");
        }

        const sufijoFecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(libro, "Cuadro_Mando_SIGMA_PMO_" + sufijoFecha + ".xlsx");
    } catch (error) {
        alert("⚠️ Error crítico al generar el Excel: " + error.message);
    }
}

// === EXPORTACIÓN PDF CORPORATIVO: HELPER ===
function obtenerRAG(pct) {
    if (pct >= 80) return { color: '#16a34a', bg: '#dcfce7', label: 'Bueno' };
    if (pct >= 50) return { color: '#ff9800', bg: '#fff3e0', label: 'Alerta' };
    return { color: '#dc2626', bg: '#fef2f2', label: 'Crítico' };
}

function leerKPIsDePantalla(disc) {
    const el = id => document.getElementById(id);
    const texto = id => { const e = el(id); return e ? e.innerText : '—'; };
    const color = id => { const e = el(id); return e && e.style.color ? e.style.color : '#888'; };
    const items = obtenerItemsADecorrer(disc);
    const sumaMetas = items.reduce((s, sub) => s + sub.meta, 0);
    const avanceTexto = texto('kpi-avance');
    const completadosTexto = texto('kpi-completados');
    const totalTexto = texto('kpi-total');
    const velocidadTexto = texto('kpi-velocidad');
    const diasTexto = texto('kpi-dias-restantes');
    const riesgoTexto = texto('kpi-riesgo');
    const rendTexto = texto('kpi-rendimiento');
    const diasColor = color('kpi-dias-restantes');
    const riesgoColor = color('kpi-riesgo');
    const rendColor = color('kpi-rendimiento');
    const diasRestantes = diasTexto.includes('día') ? parseInt(diasTexto, 10) : null;
    const restante = diasTexto === '✅ Completo' ? 0 : (diasRestantes !== null ? diasRestantes * 0 : null);
    const esCompleto = diasTexto === '✅ Completo' || riesgoTexto === '✅ Completo';
    return {
        avanceTexto, completadosTexto, totalTexto, velocidadTexto,
        diasTexto, riesgoTexto, rendTexto,
        diasColor, riesgoColor, rendColor,
        sumaMetas, diasRestantes, esCompleto
    };
}

function generarHTMLPortada(discLabel) {
    const hoy = new Date();
    const fechaStr = hoy.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const periodo = document.getElementById('fecha-desde').value || 'Inicio';
    const periodoHasta = document.getElementById('fecha-hasta').value || hoy.toISOString().split('T')[0];
    return `<div class="pdf-pagina pdf-portada">
        <div style="margin-bottom:30px;">
            <div class="pdf-portada-logo">ELECNOR</div>
            <div class="pdf-portada-logo-sub">Project Management Office</div>
        </div>
        <div class="pdf-portada-badge">SIGMA PMO</div>
        <div class="pdf-portada-titulo">INFORME EJECUTIVO<br>DE PRODUCCIÓN</div>
        <div class="pdf-portada-linea"></div>
        <div class="pdf-portada-subtitulo">Panel de Control de Obra — Planta Solar Fotovoltaica</div>
        <div style="width:80%; margin-top:15px; border-top:1px solid #e2e8f0; padding-top:25px;">
            <div class="pdf-portada-info">
                <strong>Delegación:</strong> ${discLabel}<br>
                <strong>Fecha del informe:</strong> ${fechaStr}<br>
                <strong>Período analizado:</strong> ${periodo} — ${periodoHasta}
            </div>
        </div>
        <div class="pdf-portada-pie">Documento generado automáticamente por SIGMA PMO — ELECNOR</div>
    </div>`;
}

function generarHTMLResumen(disc) {
    const kpi = leerKPIsDePantalla(disc);

    let html = `<div class="pdf-pagina">
        <div class="pdf-seccion-titulo">RESUMEN EJECUTIVO</div>
        <div class="pdf-kpi-grid">
            <div class="pdf-kpi-card pdf-kpi-destacado">
                <h4>Avance Acumulado</h4>
                <div class="pdf-kpi-val">${kpi.avanceTexto}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Ítems Completados</h4>
                <div class="pdf-kpi-val">${kpi.completadosTexto}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Producción a la Fecha</h4>
                <div class="pdf-kpi-val">${kpi.totalTexto}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Meta Total</h4>
                <div class="pdf-kpi-val">${Math.round(kpi.sumaMetas).toLocaleString()}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Velocidad Promedio</h4>
                <div class="pdf-kpi-val">${kpi.velocidadTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Días Restantes Est.</h4>
                <div class="pdf-kpi-val" style="color:${kpi.diasColor}">${kpi.diasTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Riesgo</h4>
                <div class="pdf-kpi-val" style="color:${kpi.riesgoColor}">${kpi.riesgoTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Rendimiento</h4>
                <div class="pdf-kpi-val" style="color:${kpi.rendColor}">${kpi.rendTexto}</div>
            </div>
        </div>`;

    const tbodyEl = document.getElementById('rag-tbody');
    let ragHtml = '';
    if (tbodyEl) {
        const filas = tbodyEl.querySelectorAll('tr');
        filas.forEach(tr => {
            const celdas = tr.querySelectorAll('td');
            if (celdas.length >= 7) {
                const nombre = celdas[0].innerText.replace(/^[📁\s└\s]*/g, '').trim();
                const items = celdas[1].innerText;
                const comp = celdas[2].innerText;
                const meta = celdas[3].innerText;
                const prod = celdas[4].innerText;
                const pct = celdas[5].innerText;
                const badgeHtml = celdas[6].innerHTML
                    .replace(/🟢|🔴|🟡/g, '')
                    .replace(/class="rag-badge"/g, 'class="pdf-rag-badge"');
                const isTotal = tr.classList.contains('rag-total-row');
                if (isTotal) {
                    ragHtml += `<tr class="pdf-total-row">
                        <td style="font-weight:900;">${nombre}</td>
                        <td>${items}</td>
                        <td>${comp}</td>
                        <td>${meta}</td>
                        <td>${prod}</td>
                        <td style="font-weight:900;">${pct}</td>
                        <td>${badgeHtml}</td>
                    </tr>`;
                } else {
                    ragHtml += `<tr>
                        <td style="font-weight:700;">${nombre}</td>
                        <td>${items}</td>
                        <td>${comp}</td>
                        <td>${meta}</td>
                        <td>${prod}</td>
                        <td style="font-weight:700;">${pct}</td>
                        <td>${badgeHtml}</td>
                    </tr>`;
                }
            }
        });
    }

    html += `<div class="pdf-seccion-subtitulo">Semáforo RAG — Resumen por ${disc === '__TODAS__' ? 'Disciplina' : 'Grupo WBS'}</div>
        <table class="pdf-tabla">
            <thead><tr>
                <th>${disc === '__TODAS__' ? 'Disciplina' : 'Grupo WBS'}</th>
                <th>Ítems</th>
                <th>Completados</th>
                <th>Meta Total</th>
                <th>Producido</th>
                <th>% Avance</th>
                <th>Estado</th>
            </tr></thead>
            <tbody>${ragHtml || '<tr><td colspan="7" style="text-align:center;padding:10px;color:#888;">No hay datos</td></tr>'}</tbody>
        </table></div>`;
    return html;
}

function generarHTMLDesglose(disc) {
    const grupos = ESTRUCTURA_DASH[disc] || {};
    if (Object.keys(grupos).length === 0) return '';
    let html = `<div class="pdf-pagina">`;
    html += `<div class="pdf-seccion-titulo">DESGLOSE TÉCNICO</div>`;
    html += `<div class="pdf-disciplina-header">${disc}</div>`;
    for (let g in grupos) {
        const items = grupos[g];
        let gMeta = 0, gProd = 0;
        items.forEach(sub => { gMeta += sub.meta; gProd += acumulados[sub.item] || 0; });
        const pctGrupo = gMeta > 0 ? Math.round((gProd / gMeta) * 100) : 0;
        const barColor = pctGrupo >= 80 ? '#16a34a' : pctGrupo >= 50 ? '#ff9800' : '#dc2626';
        html += `<div class="pdf-grupo-wbs">
            <div class="pdf-grupo-titulo">${g} — ${Math.min(pctGrupo, 100)}% completado</div>
            <table class="pdf-tabla-detalle">
                <thead><tr>
                    <th style="width:40%;">Ítem / Tarea</th>
                    <th style="width:12%;">Unidad</th>
                    <th style="width:16%;">Meta</th>
                    <th style="width:16%;">Instalado</th>
                    <th style="width:16%;">Rendimiento</th>
                </tr></thead>
                <tbody>`;
        for (let sub of items) {
            const prod = acumulados[sub.item] || 0;
            const pctItem = sub.meta > 0 ? Math.min(100, Math.round((prod / sub.meta) * 100)) : 0;
            const itemBarColor = pctItem >= 80 ? '#16a34a' : pctItem >= 50 ? '#ff9800' : '#dc2626';
            html += `<tr>
                <td style="font-weight:600;">${sub.item}</td>
                <td>${sub.unidad}</td>
                <td>${Math.round(sub.meta).toLocaleString()}</td>
                <td>${Math.round(prod).toLocaleString()}</td>
                <td>
                    <span class="pdf-barra-progreso"><span class="pdf-barra-llenado" style="width:${pctItem}%;background:${itemBarColor};"></span></span>
                    ${pctItem}%
                </td>
            </tr>`;
        }
        html += `</tbody></table>
            <div class="pdf-pie-tabla">Progreso del grupo: ${Math.min(pctGrupo, 100)}% — ${Math.round(gProd).toLocaleString()} / ${Math.round(gMeta).toLocaleString()} uds.</div>
        </div>`;
    }
    html += `</div>`;
    return html;
}

function generarHTMLResumenDesdeDatos(disc) {
    const items = obtenerItemsADecorrer(disc);
    let sumaMetas = 0, sumaProd = 0, completados = 0, totalItems = items.length;
    for (let sub of items) {
        const prod = acumulados[sub.item] || 0;
        sumaMetas += sub.meta; sumaProd += prod;
        if (prod >= sub.meta && sub.meta > 0) completados++;
    }
    const avancePct = sumaMetas > 0 ? (sumaProd / sumaMetas) * 100 : 0;
    const fechasOrd = obtenerFechasOrdenadas();
    const diasActivos = fechasOrd.filter(f => {
        if (!HISTORIAL[f]) return false;
        for (let d in HISTORIAL[f]) {
            for (let g in HISTORIAL[f][d]) {
                if (HISTORIAL[f][d][g].some(i => i.cantidad > 0)) return true;
            }
        }
        return false;
    });
    const velocidad = diasActivos.length > 0 && sumaMetas > 0 ? sumaProd / diasActivos.length : 0;
    const restante = sumaMetas - sumaProd;
    const diasRestantes = velocidad > 0 ? Math.ceil(restante / velocidad) : null;
    const kpiAvance = avancePct < 1 && avancePct > 0 ? avancePct.toFixed(2) + '%' : Math.round(avancePct) + '%';
    const kpiProd = sumaProd < 1 && sumaProd > 0 ? sumaProd.toFixed(2) : Math.round(sumaProd).toLocaleString();
    const velTexto = velocidad > 0 ? (velocidad < 1 ? velocidad.toFixed(2) : Math.round(velocidad).toLocaleString()) + ' ud/día' : '—';
    const diasTexto = diasRestantes !== null && diasRestantes >= 0 && diasRestantes < 9999 ? diasRestantes + ' días' : (restante <= 0 ? 'Completo' : '—');
    const diasColor = diasRestantes !== null && diasRestantes <= 7 ? '#dc2626' : diasRestantes !== null && diasRestantes <= 30 ? '#ff9800' : '#6d28d9';

    let riesgoTexto = '', riesgoColor = '';
    if (fechasOrd.length >= 2) {
        const inicio = new Date(fechasOrd[0]), fin = new Date(fechasOrd[fechasOrd.length - 1]), hoy = new Date();
        const totalDur = fin - inicio;
        const pctTiempo = totalDur > 0 ? Math.min(1, Math.max(0, (hoy - inicio) / totalDur)) * 100 : 0;
        const diff = avancePct - pctTiempo;
        if (avancePct >= 100) { riesgoTexto = 'Completo'; riesgoColor = '#16a34a'; }
        else if (diff >= 5) { riesgoTexto = 'Bajo'; riesgoColor = '#16a34a'; }
        else if (diff >= -10) { riesgoTexto = 'Medio'; riesgoColor = '#ff9800'; }
        else { riesgoTexto = 'Alto'; riesgoColor = '#dc2626'; }
    } else {
        riesgoTexto = '—'; riesgoColor = '#888';
    }

    let rendTexto = '—', rendColor = '#888';
    if (fechasOrd.length >= 2 && totalItems > 0) {
        const inicio = new Date(fechasOrd[0]), fin = new Date(fechasOrd[fechasOrd.length - 1]), hoy = new Date();
        const totalDur = fin - inicio;
        const pctTiempo = totalDur > 0 ? Math.min(1, Math.max(0, (hoy - inicio) / totalDur)) * 100 : 0;
        if (pctTiempo > 0) {
            const rend = (avancePct / pctTiempo) * 100;
            rendTexto = Math.round(rend) + '%';
            rendColor = rend >= 95 ? '#16a34a' : rend >= 70 ? '#ff9800' : '#dc2626';
        }
    }

    let html = `<div class="pdf-pagina">
        <div class="pdf-seccion-titulo">RESUMEN EJECUTIVO</div>
        <div class="pdf-kpi-grid">
            <div class="pdf-kpi-card pdf-kpi-destacado">
                <h4>Avance Acumulado</h4>
                <div class="pdf-kpi-val">${kpiAvance}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Ítems Completados</h4>
                <div class="pdf-kpi-val">${completados} / ${totalItems}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Producción a la Fecha</h4>
                <div class="pdf-kpi-val">${kpiProd}</div>
            </div>
            <div class="pdf-kpi-card">
                <h4>Meta Total</h4>
                <div class="pdf-kpi-val">${Math.round(sumaMetas).toLocaleString()}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Velocidad Promedio</h4>
                <div class="pdf-kpi-val">${velTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Días Restantes Est.</h4>
                <div class="pdf-kpi-val" style="color:${diasColor}">${diasTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Riesgo</h4>
                <div class="pdf-kpi-val" style="color:${riesgoColor}">${riesgoTexto}</div>
            </div>
            <div class="pdf-kpi-card pdf-kpi-purpura">
                <h4>Rendimiento</h4>
                <div class="pdf-kpi-val" style="color:${rendColor}">${rendTexto}</div>
            </div>
        </div>`;

    const filasRAG = [];
    let totalMeta = 0, totalProd = 0, totalItemsRag = 0, totalComp = 0;
    const discLabel = disc === '__TODAS__' ? 'Disciplina' : 'Grupo WBS';
    const computeRagRows = (d) => {
        if (d === '__TODAS__') {
            for (let dName in ESTRUCTURA_DASH) computeRagRows(dName);
            return;
        }
        const grupos = ESTRUCTURA_DASH[d] || {};
        for (let g in grupos) {
            let gMeta = 0, gProd = 0, gItems = 0, gComp = 0;
            grupos[g].forEach(sub => {
                gItems++; const prod = acumulados[sub.item] || 0;
                gMeta += sub.meta; gProd += prod;
                if (prod >= sub.meta && sub.meta > 0) gComp++;
            });
            const pct = gMeta > 0 ? Math.round((gProd / gMeta) * 100) : 0;
            const rag = obtenerRAG(pct);
            filasRAG.push({
                nombre: disc === '__TODAS__' ? d + ' / ' + g : g,
                items: gItems, comp: gComp,
                meta: gMeta, prod: gProd,
                pct: Math.min(pct, 100), rag
            });
            totalMeta += gMeta; totalProd += gProd;
            totalItemsRag += gItems; totalComp += gComp;
        }
    };
    computeRagRows(disc);

    html += `<div class="pdf-seccion-subtitulo">Semáforo RAG — Resumen por ${discLabel}</div>
        <table class="pdf-tabla">
            <thead><tr>
                <th>${discLabel}</th>
                <th>Ítems</th>
                <th>Completados</th>
                <th>Meta Total</th>
                <th>Producido</th>
                <th>% Avance</th>
                <th>Estado</th>
            </tr></thead>
            <tbody>`;
    for (let f of filasRAG) {
        html += `<tr>
            <td style="font-weight:700;">${f.nombre}</td>
            <td>${f.items}</td>
            <td>${f.comp}</td>
            <td>${Math.round(f.meta).toLocaleString()}</td>
            <td>${Math.round(f.prod).toLocaleString()}</td>
            <td style="font-weight:700;">${f.pct}%</td>
            <td><span class="pdf-rag-badge" style="background:${f.rag.bg};color:${f.rag.color};border:1px solid ${f.rag.color};">${f.rag.label}</span></td>
        </tr>`;
    }
    if (filasRAG.length > 1) {
        const totalPct = totalMeta > 0 ? Math.round((totalProd / totalMeta) * 100) : 0;
        const totalRag = obtenerRAG(totalPct);
        html += `<tr class="pdf-total-row">
            <td style="font-weight:900;">TOTAL</td>
            <td>${totalItemsRag}</td>
            <td>${totalComp}</td>
            <td>${Math.round(totalMeta).toLocaleString()}</td>
            <td>${Math.round(totalProd).toLocaleString()}</td>
            <td style="font-weight:900;">${Math.min(totalPct, 100)}%</td>
            <td><span class="pdf-rag-badge" style="background:${totalRag.bg};color:${totalRag.color};border:1px solid ${totalRag.color};">${totalRag.label}</span></td>
        </tr>`;
    }
    html += `</tbody></table></div>`;
    return html;
}

function construirPaginasPDF(disc, usarPantalla) {
    const discLabel = disc === '__TODAS__' ? 'Todas las disciplinas' : disc;
    const paginas = [];
    paginas.push(generarHTMLPortada(discLabel));
    if (disc === '__TODAS__' && usarPantalla) {
        paginas.push(generarHTMLResumen(disc));
    } else if (disc === '__TODAS__') {
        paginas.push(generarHTMLResumenDesdeDatos(disc));
    } else {
        paginas.push(generarHTMLResumen(disc));
    }
    if (disc === '__TODAS__') {
        for (let d in ESTRUCTURA_DASH) {
            const p = generarHTMLDesglose(d);
            if (p) paginas.push(p);
        }
    } else {
        const p = generarHTMLDesglose(disc);
        if (p) paginas.push(p);
    }
    return paginas;
}

function renderizarPDF(paginasHtml, filename, btn) {
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Generando...";
    btn.style.opacity = "0.7";
    btn.disabled = true;

    try {
        // 1. Clone the dashboard's main container while it is fully visible,
        //    WITHOUT applying any CSS transform or hiding to the source
        const fuente = document.getElementById('area-impresion-pdf');
        if (!fuente) throw new Error('No se encontró #area-impresion-pdf');

        const clon = fuente.cloneNode(false);
        // Ensure the clone does NOT inherit opacity:0 or visibility:hidden
        clon.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:white;opacity:1;visibility:visible;z-index:-1;pointer-events:none;display:block;';

        // 2. Build and inject the full PDF layout
        let htmlCompleto = '';
        for (let i = 0; i < paginasHtml.length; i++) {
            if (i > 0) htmlCompleto += '<div class="html2pdf__page-break"></div>';
            htmlCompleto += paginasHtml[i];
        }
        clon.innerHTML = htmlCompleto;
        clon.className = 'pdf-template-content';

        document.body.appendChild(clon);

        // 3. Wait two animation frames for layout before capturing
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                html2pdf().set({
                    margin: 0,
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: false },
                    jsPDF: { format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: 'legacy' }
                }).from(clon).save().then(() => {
                    if (clon.parentNode) clon.parentNode.removeChild(clon);
                    btn.innerText = textoOriginal;
                    btn.style.opacity = "1";
                    btn.disabled = false;
                }).catch((e) => {
                    if (clon.parentNode) clon.parentNode.removeChild(clon);
                    btn.innerText = textoOriginal;
                    btn.style.opacity = "1";
                    btn.disabled = false;
                    console.error('Error html2pdf:', e);
                    alert('⚠️ Error al generar el PDF: ' + (e && e.message ? e.message : 'error desconocido'));
                });
            });
        });
    } catch (e) {
        btn.innerText = textoOriginal;
        btn.style.opacity = "1";
        btn.disabled = false;
        console.error('Error crítico en renderizarPDF:', e);
        alert('⚠️ Error crítico al generar el PDF: ' + (e.message || 'error desconocido'));
    }
}

// === EXPORTACIÓN PDF CORPORATIVO ===
function exportarInformeEspecifico() {
    procesarAcumulados();
    if (typeof dibujarTablaRAG === 'function') dibujarTablaRAG();
    const disc = document.getElementById('filtro-disc').value;
    const discLabel = disc === '__TODAS__' ? 'todas-las-disciplinas' : disc.replace(/\s+/g, '-').toLowerCase();
    const filename = `Informe_Ejecutivo_${discLabel}_${new Date().toISOString().split('T')[0]}.pdf`;
    const btn = document.getElementById('btn-pdf-specific');
    const paginas = construirPaginasPDF(disc, true);
    renderizarPDF(paginas, filename, btn);
}

function exportarInformeCompleto() {
    procesarAcumulados();
    const filename = `Informe_Ejecutivo_Completo_${new Date().toISOString().split('T')[0]}.pdf`;
    const btn = document.getElementById('btn-pdf-full');
    const paginas = construirPaginasPDF('__TODAS__', false);
    renderizarPDF(paginas, filename, btn);
}