// js/data.js

const DISCIPLINAS = ['Logística', 'Civil', 'Mecánicos', 'Eléctricos', 'Línea de Alta Tensión'];
const UNIDADES = ['uds', 'ml', 'm3', '%', 'ha', 'lote'];

const ESTRUCTURA_MAESTRA = {
    'Logística': {
        '1.1 HINCAS': [{ item: 'Suministro de hincas', meta: 0, unidad: 'uds' }],
        '1.2 ESTRUCTURA': [{ item: 'Suministro de estructura Axial', meta: 0, unidad: 'uds' }],
        '1.3 MÓDULOS': [{ item: 'Suministro de módulos', meta: 0, unidad: 'uds' }],
        '1.4 INVERSORES': [{ item: 'Suministro de inversores', meta: 0, unidad: 'uds' }],
        '1.5 CABLES': [{ item: 'Suministro de cables TOP CABLE', meta: 0, unidad: 'ml' }],
        '1.6 SCBs': [{ item: 'Suministro de SCBs Renovagy', meta: 0, unidad: 'uds' }],
        '1.7 SCADA y CCTV': [{ item: 'Suministro de SCADA', meta: 0, unidad: 'uds' }, { item: 'Suministro de CCTV', meta: 0, unidad: 'uds' }]
    },
    'Civil': {
        '2.1 MOVIMIENTO DE TIERRAS': [{ item: 'Desmonte', meta: 0, unidad: 'm3' }, { item: 'Terraplén', meta: 0, unidad: 'm3' }, { item: 'Nivelación', meta: 0, unidad: 'm3' }],
        '2.2 VALLADO PERIMETRAL': [{ item: 'Vallado perimetral', meta: 0, unidad: 'ml' }],
        '2.3 VIALES': [{ item: 'Cajeado', meta: 0, unidad: 'm3' }, { item: 'Pasos', meta: 0, unidad: 'uds' }, { item: 'Relleno de sub-base', meta: 0, unidad: 'm3' }, { item: 'Relleno de base', meta: 0, unidad: 'm3' }],
        '2.4 LOSAS POWER STATION': [{ item: 'Plataforma', meta: 0, unidad: 'm3' }, { item: 'Instalacion de tubos', meta: 0, unidad: 'ml' }, { item: 'Losa de hormigon', meta: 0, unidad: 'm3' }],
        '2.5 DRENAJES': [{ item: 'Drenajes trapezoidales', meta: 0, unidad: 'ml' }, { item: 'ODT', meta: 0, unidad: 'uds' }],
        '2.6 ZANJAS DE BT': [{ item: 'Excavacion', meta: 0, unidad: 'ml' }, { item: 'Instalacion de tubos', meta: 0, unidad: 'ml' }, { item: 'Relleno', meta: 0, unidad: 'ml' }],
        '2.7 ZANJAS DE MT': [{ item: 'Excavacion', meta: 0, unidad: 'ml' }, { item: 'Relleno', meta: 0, unidad: 'ml' }],
        '2.8 ARQUETAS': [{ item: 'Arquetas de BT', meta: 0, unidad: 'uds' }, { item: 'Arquetas de MT', meta: 0, unidad: 'uds' }, { item: 'Arquetas de CCTV', meta: 0, unidad: 'uds' }],
        '2.9 CCTV': [{ item: 'Excavacion de zanjas', meta: 0, unidad: 'ml' }, { item: 'Instalacion de tubos', meta: 0, unidad: 'ml' }, { item: 'Relleno de zanjas', meta: 0, unidad: 'ml' }, { item: 'Ejecucion de bases', meta: 0, unidad: 'uds' }],
        '2.10 EDIFICIO OM': [{ item: 'Movimiento de tierras', meta: 0, unidad: 'm3' }, { item: 'Cimentaciones', meta: 0, unidad: 'm3' }, { item: 'Pilares', meta: 0, unidad: 'uds' }, { item: 'Fachadas y particiones', meta: 0, unidad: 'm2' }, { item: 'Cubierta', meta: 0, unidad: 'm2' }, { item: 'Enfoscados', meta: 0, unidad: 'm2' }, { item: 'Instalacion de fontaneria', meta: 0, unidad: 'lote' }, { item: 'Instalacion electrica', meta: 0, unidad: 'lote' }, { item: 'Instalacion contra incendios', meta: 0, unidad: 'lote' }, { item: 'Acabados', meta: 0, unidad: 'lote' }]
    },
    'Mecánicos': {
        '3.1 INSTALACIÓN DE HINCAS': [{ item: 'Instalación de hincas', meta: 0, unidad: 'uds' }],
        '3.2 MONTAJE DE ESTRUCTURA': [{ item: 'Montaje de estructura', meta: 0, unidad: 'uds' }],
        '3.3 MONTAJE DE MODULOS': [{ item: 'Montaje de módulos', meta: 0, unidad: 'uds' }]
    },
    'Eléctricos': {
        '4.1 STRINGS': [{ item: 'Conexionado de modulos', meta: 0, unidad: 'uds' }, { item: 'Tendido de cable solar', meta: 0, unidad: 'ml' }, { item: 'Conexionado de cable solar - MC4', meta: 0, unidad: 'uds' }],
        '4.2 CABLE BT': [{ item: 'Red de tierra', meta: 0, unidad: 'ml' }, { item: 'Tendido de cable de BT', meta: 0, unidad: 'ml' }, { item: 'Conexionado de cable en SCB', meta: 0, unidad: 'uds' }],
        '4.3 CABLE MT': [{ item: 'Red de tierra', meta: 0, unidad: 'ml' }, { item: 'Tendido de cable de MT', meta: 0, unidad: 'ml' }, { item: 'Tendido de F.O.', meta: 0, unidad: 'ml' }],
        '4.4 Cable GW Tracker': [{ item: 'Tendido', meta: 0, unidad: 'ml' }, { item: 'Conexionado', meta: 0, unidad: 'uds' }],
        '4.5 SCBs': [{ item: 'Instalacion mecánica de cajas', meta: 0, unidad: 'uds' }, { item: 'Conexionado de string en SCB', meta: 0, unidad: 'uds' }],
        '4.6 Power Station': [{ item: 'Instalacion de Equipos', meta: 0, unidad: 'uds' }, { item: 'Conexionado BT', meta: 0, unidad: 'uds' }, { item: 'Conexionado MT (por botella)', meta: 0, unidad: 'uds' }, { item: 'Pararrayos', meta: 0, unidad: 'uds' }],
        '4.7 Centro de Seccionamiento': [{ item: 'Instalacion de Equipos', meta: 0, unidad: 'uds' }, { item: 'Conexionado MT (por botella)', meta: 0, unidad: 'uds' }],
        '4.8 CCTV': [{ item: 'Instalacion de camaras', meta: 0, unidad: 'uds' }, { item: 'Cableado y conexionado', meta: 0, unidad: 'uds' }, { item: 'Instalacion de control de accesos', meta: 0, unidad: 'uds' }],
        '4.9 SCADA PV': [{ item: 'Instalacion Scada hardware', meta: 0, unidad: 'uds' }, { item: 'Fusionado de fibra', meta: 0, unidad: 'uds' }, { item: 'Configuracion de equipos', meta: 0, unidad: 'uds' }],
        '4.10 ESTACIÓN METEOROLÓGICA': [{ item: 'Estación Meteorológica', meta: 0, unidad: 'lote' }]
    },
    'Línea de Alta Tensión': {
        '6.1 LAT': [{ item: 'Excavacion', meta: 0, unidad: 'ml' }, { item: 'Cimentacion de apoyos', meta: 0, unidad: 'm3' }, { item: 'Puesta a tierra', meta: 0, unidad: 'ml' }, { item: 'Izado de apoyos', meta: 0, unidad: 'uds' }, { item: 'Tendido de cables', meta: 0, unidad: 'ml' }]
    }
};