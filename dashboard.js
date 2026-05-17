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

// === EXPORTACIÓN PDF — INFORME ESPECÍFICO (vista filtrada actual) ===
function exportarInformeEspecifico() {
    const elemento = document.getElementById('area-impresion-pdf');
    const disc = document.getElementById('filtro-disc').value;
    const discLabel = disc === '__TODAS__' ? 'todas-las-disciplinas' : disc.replace(/\s+/g, '-').toLowerCase();
    const btn = document.getElementById('btn-pdf-specific');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Generando..."; btn.style.opacity = "0.7"; btn.disabled = true;

    elemento.classList.add('exportando-pdf');

    html2pdf().set({
        margin: [10, 10, 20, 10],
        filename: `Informe_Especifico_${discLabel}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(elemento).toPdf().get('pdf').then((pdf) => {
        const totalPaginas = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(113, 128, 150);
            pdf.text(`Página ${i} de ${totalPaginas} | SIGMA PMO - Elecnor`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
        }
    }).save().then(() => {
        elemento.classList.remove('exportando-pdf');
        btn.innerText = textoOriginal; btn.style.opacity = "1"; btn.disabled = false;
    }).catch(() => {
        elemento.classList.remove('exportando-pdf');
        btn.innerText = textoOriginal; btn.style.opacity = "1"; btn.disabled = false;
        alert('⚠️ Error al generar el informe específico.');
    });
}

// === EXPORTACIÓN PDF — INFORME COMPLETO (dashboard completo con KPIs + RAG) ===
function exportarInformeCompleto() {
    const btn = document.getElementById('btn-pdf-full');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Generando..."; btn.style.opacity = "0.7"; btn.disabled = true;

    const discSelect = document.getElementById('filtro-disc');
    const valorOriginal = discSelect.value;
    
    // Temporalmente cambiar a todas las disciplinas para capturar el dashboard completo
    discSelect.value = '__TODAS__';
    cambiarDisciplina();
    
    // Esperar a que los gráficos se rendericen antes de capturar
    setTimeout(() => {
        const elemento = document.getElementById('area-impresion-pdf');
        elemento.classList.add('exportando-pdf');

        html2pdf().set({
            margin: [10, 10, 20, 10],
            filename: `Informe_Completo_PMO_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }).from(elemento).toPdf().get('pdf').then((pdf) => {
            const totalPaginas = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPaginas; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(113, 128, 150);
                pdf.text(`Página ${i} de ${totalPaginas} | SIGMA PMO - Elecnor`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
            }
        }).save().then(() => {
            elemento.classList.remove('exportando-pdf');
            discSelect.value = valorOriginal;
            cambiarDisciplina();
            btn.innerText = textoOriginal; btn.style.opacity = "1"; btn.disabled = false;
        }).catch(() => {
            elemento.classList.remove('exportando-pdf');
            discSelect.value = valorOriginal;
            cambiarDisciplina();
            btn.innerText = textoOriginal; btn.style.opacity = "1"; btn.disabled = false;
            alert('⚠️ Error al generar el informe completo.');
        });
    }, 1000);
}