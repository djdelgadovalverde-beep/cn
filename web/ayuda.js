'use strict';
/* Ayuda interactiva: botón «?» en cada pantalla (explicación de la pantalla y de la pestaña activa), recorrido guiado con foco sobre
   los elementos reales, bienvenida la primera vez y Centro de ayuda con buscador, glosario y preguntas frecuentes. */
(function () {
  NAV.ayuda = ['Centro de ayuda', ['admin', 'gerencia', 'supervisor', 'asesor']];
  if (typeof ICON !== 'undefined') ICON.ayuda = '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/>';
  if (typeof GROUPS !== 'undefined' && !GROUPS.some(([t]) => t === 'Ayuda')) GROUPS.push(['Ayuda', ['ayuda']]);

  const H = {
    dashboard: { t: 'Dashboard', que: 'Tu panel de control del mes: el puntaje final y cada componente (visitas 20 %, tareas 30 %, tareas de frío 30 %, SOS 10 %, SOE 10 %) comparado con su meta.',
      pasos: ['Elige el <b>Mes</b> arriba para ver otro período.', 'Mira los colores: verde cumple la meta, amarillo está cerca, rojo está por debajo.', 'Empieza por el componente más bajo: es donde más puedes mejorar.', 'Si eres supervisor o gerencia, revisa el detalle por supervisor y por ECM.'],
      tips: ['El puntaje solo cuenta lo ya justificado: si tienes pendientes sin motivo, justifícalos en «Asignar motivos».'], tour: [['#main .bar', 'Mes', 'Cambia el mes para comparar períodos.'], ['#main .kp, #main .card', 'Puntaje y componentes', 'Aquí ves cómo vas contra la meta en cada componente.']] },
    visitas: { t: 'Visitas', que: 'Análisis de las visitas a los puntos de venta: cuáles fueron efectivas, perdidas, fuera de rango o demasiado cortas, y por qué.',
      pasos: ['Elige el <b>rango de fechas</b> (hay atajos: hoy, semana, mes).', 'Filtra por supervisor, BDR o categoría si lo necesitas.', 'Recorre las pestañas del menú lateral: de lo general (Dashboard, Ranking) a lo específico (Reincidencias, Duración).', 'Para justificar una visita ve a «Registro y justificación».', 'Descarga lo que ves con los botones Excel, PNG o PDF de cada tabla.'],
      tips: ['Una visita cuenta como efectiva si se realizó, está dentro del rango del PDV y duró al menos el mínimo (2 minutos por defecto).', 'Los filtros se aplican a todas las pestañas.'],
      tabs: { dash: 'Resumen: efectividad, cascada del plan a las efectivas y tendencia por día.', sbd: 'Ranking de supervisores y mercaderistas de mejor a peor.', inf: 'Informe de motivos: por qué fallaron las no efectivas, por responsable y por día de la semana.', jus: 'Justificaciones registradas con su estado y evidencia.', par: 'Pareto de motivos y su evolución mensual.', cal: 'Calidad del registro: datos incompletos o sospechosos.', rei: 'Clientes con fallas repetidas.', afe: 'Clientes más afectados por visitas no efectivas.', dur: 'Duración de las visitas: cortas y largas.', time: 'Línea de tiempo de la jornada.', heat: 'Mapa de calor por día y hora o por ECM.', pen: 'Antigüedad de lo pendiente de justificar.', pry: 'Proyección de cierre del mes según el ritmo actual.', ins: 'Hallazgos automáticos y recomendaciones.', cmp: 'Cruce antifraude: contrasta visitas con evidencias y enlaces de Involves.', det: 'Registro y justificación: aquí se asignan los motivos.' },
      tour: [['#main .bar, #main .fbar', 'Filtros', 'Fechas, supervisor, BDR y categoría. Se aplican a todas las pestañas.'], ['#nav .ssub', 'Pestañas', 'Cambian la vista del análisis. Se pliegan con la flecha del menú.'], ['#main .kp', 'Indicadores', 'Los números clave del período elegido.'], ['#main .card', 'Tablas y gráficos', 'Cada tabla se puede ordenar y exportar a Excel, PNG o PDF.']] },
    tareas: { t: 'Tareas', que: 'Igual que Visitas, pero para las tareas asignadas en Involves. Cada tarea es efectiva (E), mal ejecutada (M), justificada (F) o pendiente (P). Aparte se mide el equipo de frío.',
      pasos: ['Elige el rango de fechas y filtros.', 'En <b>Pilares y frío</b> mira el cumplimiento de las tareas de equipo de frío (valen 30 % del puntaje).', 'En <b>Reincidencias</b> identifica los clientes con tareas fallidas repetidas.', 'Justifica en «Registro y justificación».'],
      tips: ['Las tareas de frío se reconocen por palabras como COOLER, ESPACIO FRÍO o NEVERA; el administrador puede ajustarlas.'],
      tabs: { dash: 'Resumen de efectividad de tareas.', sbd: 'Ranking de supervisores y ECM.', inf: 'Informe de motivos de las no efectivas.', jus: 'Justificaciones registradas.', par: 'Pareto de motivos.', cal: 'Calidad del registro.', pil: 'Pilares y equipo de frío.', rei: 'Clientes con tareas fallidas repetidas.', time: 'Línea de tiempo.', heat: 'Mapa de calor.', pen: 'Antigüedad de lo pendiente.', pry: 'Proyección del mes.', ins: 'Hallazgos automáticos.', cmp: 'Cruce antifraude.', det: 'Registro y justificación: asignar motivos.' },
      tour: [['#main .bar, #main .fbar', 'Filtros', 'Fechas, supervisor, ECM y categoría.'], ['#nav .ssub', 'Pestañas', 'Incluye «Pilares y frío», exclusiva de tareas.'], ['#main .card', 'Tablas y gráficos', 'Exportables a Excel, PNG o PDF.']] },
    audit: { t: 'Auditoría de justificaciones', que: 'Control de calidad de las justificaciones: en qué se justifica, quién repite, qué debe revisarse y qué cambios se hicieron.',
      pasos: ['Define el rango de fechas.', 'En <b>Para revisar</b> aprueba o rectifica las justificaciones con alertas.', 'En <b>Avance por supervisor</b> revisa quién mantiene sus pendientes al día.', 'En <b>Historial de cambios</b> (gerencia y administración) consulta quién cambió qué y cuándo.'],
      tips: ['Observaciones idénticas repetidas muchas veces suelen indicar justificación genérica.'], tabs: { mot: 'Motivos y responsable de lo justificado.', evo: 'Evolución mensual por motivo.', rei: 'Mismo cliente con el mismo motivo varias veces.', rev: 'Cola de justificaciones con alertas para aprobar o rectificar.', obs: 'Textos de observación que más se repiten.', ava: 'Porcentaje de lo no efectivo ya justificado, por supervisor.', his: 'Historial legible de cambios en la plataforma.' } },
    sos: { t: 'SOS y SOE', que: 'Share de góndola de las marcas CN: SOS mide la percha; SOE mide espacios (bandejas de frío, bandejas secas y rumas). Se calcula por semana operativa (miércoles a martes).',
      pasos: ['Abre <b>Resumen semanal</b> y usa las flechas ‹ › para cambiar de semana.', 'Compara con la semana anterior y mira los PDV bajo la meta.', 'En <b>PDV</b>, <b>Segmentos y marcas</b> y <b>Productos</b> busca dónde falta percha o espacio.', 'En <b>Alertas</b> ve lo que cae fuera de lo normal.'],
      tips: ['Las encuestas de lunes y martes no cuentan.', 'Si un PDV tiene varias encuestas en la semana, vale solo la más reciente.', 'Una semana puede mostrar pocos días porque aún no se cargó toda la información.'],
      tabs: { sem: 'Resumen semanal: share de la semana contra la anterior, PDV bajo meta, espacios ganados y metas. Se puede copiar o imprimir.', res: 'Evolución semana a semana.', sos: 'SOS: detalle de percha por supervisor, ECM, región o cadena.', soe: 'SOE: detalle de espacios.', mar: 'Participación por segmento y marca.', sku: 'Detalle por producto (SKU).', pdv: 'Cada PDV con su share y variación.', bi: 'Análisis: afectación al share y cambios relevantes.', ale: 'Alertas: PDV o ECM sin datos o con caídas.', det: 'Detalle editable (solo con permiso) para corregir filas.' },
      tour: [['.wknav', 'Semana', 'Cambia de semana con las flechas. La semana va de miércoles a martes.'], ['#main .fbar, #main .bar', 'Filtros', 'Región, cadena, supervisor, ECM y PDV.'], ['#main .card, #main .big', 'Resultados', 'Share de percha y de espacios contra la semana anterior.']] },
    ganancias: { t: 'Espacios ganados', que: 'Caras y rumas que se lograron ganar en los PDV (percha, bandeja de frío, bandeja seca y ruma), con fotos y observaciones.',
      pasos: ['Filtra por fechas, ECM o PDV.', 'Revisa que tus logros aparezcan con su foto.', 'Quien tenga permiso puede registrar o corregir espacios ganados.'], tips: ['Si falta un logro, avisa a tu supervisor o al administrador.'] },
    plan: { t: 'Plan diario', que: 'Calcula cuántos PDV y visitas debe cubrir cada ECM por día para llegar a la meta del período.',
      pasos: ['Elige el período y revisa lo planeado para hoy.', 'Úsalo al empezar la jornada para ordenar tu ruta.', 'Compara con «Alcance de metas» al terminar el día.'] },
    alcance: { t: 'Alcance de metas', que: 'Avance real por ECM y por día contra el plan: quién va adelantado y quién atrasado.',
      pasos: ['Elige el período.', 'Revisa el avance de cada día frente a lo planeado.', 'Si vas por debajo, planea compensar en los días siguientes.'] },
    metas: { t: 'Metas y alcance', que: 'Metas vigentes por semana o mes (SOS, SOE, visitas, tareas, frío). Quien tenga permiso puede crear y editar metas personalizadas, que tienen prioridad sobre las metas por defecto.',
      pasos: ['Elige el período.', 'Consulta la meta aplicable a tu zona o a ti.', 'Con permiso: crea o edita una meta indicando modo, valor, regiones y responsable.'] },
    registro: { t: 'Asignar motivos', que: 'Pantalla de trabajo diario para explicar con un motivo las visitas y tareas no efectivas. Siempre abre mostrando los pendientes.',
      pasos: ['Elige <b>Visitas</b> o <b>Tareas</b>.', 'Filtra por fechas, categoría, ECM, duración o texto. Las tarjetas de arriba también filtran al pulsarlas.', 'Marca los registros (o «Seleccionar los filtrados»).', 'Elige el <b>motivo</b> y, si quieres, escribe una observación.', 'Pulsa <b>Aplicar a seleccionados</b>.', 'Pulsa <b>Guardar cambios</b> en la barra de abajo: hasta entonces nada queda registrado.'],
      tips: ['💡 «Aplicar los sugeridos» propone motivos según la observación.', '🔁 «Revisar y replicar» copia el motivo de casos repetidos.', '📎 Puedes adjuntar una foto o enlaces de Involves (JPG, PNG o WebP, máximo 2 MB).', 'Si no puedes marcar ni guardar, tu tipo de usuario no tiene permiso de justificar.'],
      tabs: { asignar: 'Asignar motivos: la lista de trabajo.', rei: 'PDV reincidentes: clientes con varias fallas, para actuar de una vez.', reg: 'Justificaciones registradas: lo ya hecho, con historial y exportación.' },
      tour: [['#main .kp', 'Estados', 'Pendientes, en gestión y justificadas. Púlsalas para filtrar.'], ['#main .fbar', 'Filtros', 'Empieza en «Pendientes». Cambia fechas, categoría, ECM o busca por cliente.'], ['#bm', 'Motivo', 'Elige aquí el motivo que vas a aplicar a los marcados.'], ['[data-act="bulk"]', 'Aplicar', 'Aplica el motivo a todos los registros seleccionados.'], ['.rt', 'Lista', 'Marca los registros con la casilla de la izquierda.'], ['.savebar', 'Guardar', 'Los cambios solo quedan registrados al pulsar «Guardar cambios».']] },
    pend: { t: 'Pendientes y WhatsApp', que: 'Lista por ECM de lo que sigue sin justificar, con un mensaje de WhatsApp ya redactado.',
      pasos: ['Revisa los pendientes de cada ECM.', 'Pulsa el botón de WhatsApp: se abre el mensaje listo para enviar.', 'Al enviarlo, el registro pasa a «en gestión».', 'Cuando el ECM responda, asigna el motivo en «Asignar motivos».'] },
    informe: { t: 'Informe mensual', que: 'Resumen del mes por ECM y supervisor con su puntaje, listo para reuniones.', pasos: ['Elige el mes.', 'Revisa el resumen por supervisor y por ECM.', 'Descarga en Excel o PDF.'] },
    rutero: { t: 'Rutero y ubicación', que: 'Los PDV asignados a cada ECM, con región, cadena y ubicación registrada.', pasos: ['Busca por código, cliente o ECM.', 'Filtra por <b>Estado</b>: activos o inactivos. Un PDV pasa a inactivo tras varias semanas sin datos y vuelve a activo si reaparecen.', 'El administrador puede activar o desactivar un PDV a mano (queda «fijo» hasta pulsar «Automático»).', 'Consulta la ubicación del PDV y úsalo para planear la ruta.'] },
    carga: { t: 'Cargar bases', que: 'Solo para el administrador. Sube los reportes (visitas, tareas, rutero, equipo ECM, encuestas, espacios ganados, metas); cada archivo se reconoce por sus encabezados.',
      pasos: ['Elige uno o varios archivos (.xlsx, .xls o .csv).', 'Revisa la lista: cada archivo muestra qué tipo es y cuántas filas trae. Quita los que no quieras.', 'Elige el modo: <b>Actualizar</b> (normal), <b>Reemplazar rango</b> o <b>Reemplazar todo</b>.', 'Pulsa subir y espera el resultado: nuevas, actualizadas, sin cambios y omitidas.', 'Tras cargar tareas, pulsa «Recalcular» en Pesos, metas y configuración.', 'Al subir el <b>rutero</b> puedes decidir el estado de los PDV: «Normal» respeta la columna Estado/Activo si el archivo la trae; «Rutero completo» deja inactivos a los PDV que no vienen en el archivo y activos a los que vienen.'],
      tips: ['Orden recomendado la primera vez: Equipo ECM, Rutero, Visitas, Tareas, Encuestas, Espacios ganados, Metas.', 'Si falla, el panel de error permanece en pantalla con la explicación.', 'No cierres la pestaña mientras sube un archivo grande.'],
      tour: [['#fl', 'Archivos', 'Elige uno o varios reportes a la vez.'], ['#lista', 'Reconocimiento', 'Aquí ves qué tipo es cada archivo antes de subirlo.']] },
    ecm: { t: 'Equipo ECM', que: 'Relación de cada mercaderista con su supervisor, región y teléfono.', pasos: ['Busca al ECM.', 'Quien tenga permiso edita supervisor, región o teléfono.', 'Mantenerlo al día evita datos «sin supervisor».'] },
    catalogo: { t: 'Catálogo de marcas', que: 'Clasifica cada pregunta de las encuestas en grupo (CN, competencia, EXCLUIR), tipo (percha, ruma, bandeja de frío o seca), marca y producto.', pasos: ['Revisa las preguntas nuevas o sin clasificar.', 'Asigna grupo, tipo y marca.', 'Guarda: el cambio afecta a todo SOS y SOE.'], tips: ['Las preguntas nuevas se clasifican solas por reglas; revisa las dudosas.'] },
    config: { t: 'Pesos, metas y configuración', que: 'Parámetros del puntaje y de las reglas: pesos, metas por defecto, semana operativa, PDV excluidos, expresión de tareas de frío y otros ajustes.',
      pasos: ['En <b>Pesos</b> ajusta los porcentajes (deben sumar 100).', 'En <b>Metas</b> define las metas por defecto.', 'En <b>Semana y exclusiones</b> indica el día de inicio y los PDV excluidos.', 'En <b>Tareas de equipo de frío</b> edita la expresión y mira la vista previa.', 'Pulsa <b>Recalcular</b> tras cambiar la expresión o cargar tareas nuevas.'] },
    usuarios: { t: 'Usuarios', que: 'Altas, bajas y claves de los usuarios. Cada uno ingresa con un código (admin, ecm035…), sin correo.',
      pasos: ['Pulsa <b>Nuevo usuario</b>.', 'Escribe código, nombre y tipo de usuario.', 'Mercaderista: código ECM/BDR. Supervisor: nombre como viene en las bases (vacío = ve todos los equipos) y regiones.', 'Entrega la clave por un canal seguro.', 'Para dar de baja, desactívalo: conserva su historial.'], tips: ['El código ECM debe coincidir con el de las bases o el usuario no verá sus datos.'] },
    permisos: { t: 'Tipos de usuario y permisos', que: 'Define qué pantallas y pestañas ve cada tipo de usuario y qué acciones puede hacer (justificar, revisar, editar metas, etc.).',
      pasos: ['Crea un tipo nuevo o elige uno existente.', 'Marca lo que puede <b>ver</b> (pantallas y pestañas).', 'Marca lo que puede <b>editar</b>.', 'Guarda y asigna el tipo a los usuarios.'], tips: ['Cargar bases es exclusivo del administrador.', 'El tipo base (admin, gerencia, supervisor, asesor) define el alcance de los datos.'] },
    motivos: { t: 'Catálogo de motivos', que: 'Lista de motivos con su responsable. CN no penaliza; cualquier otro responsable sí.', pasos: ['Activa o desactiva motivos.', 'Pulsa «Nuevo» para crear uno: nombre, responsable y si aplica a visitas, tareas o ambos.'] },
    accesos: { t: 'Accesos y movimiento', que: 'Quién entró, cuándo, qué pantallas vio y qué cambió en los últimos días. Solo administrador.',
      pasos: ['Elige el período: 24 horas, 3 o 7 días.', '<b>Resumen por usuario:</b> último acceso, días activos y cambios; avisa quién no ha entrado.', '<b>Accesos:</b> cada ingreso y pantalla visitada; filtra por usuario.', '<b>Movimiento:</b> cambios hechos y por quién.'], tabs: { res: 'Resumen por usuario.', acc: 'Lista de ingresos y pantallas.', mov: 'Cambios registrados en la plataforma.' } },
    ayuda: { t: 'Centro de ayuda', que: 'Todas las explicaciones en un solo lugar.', pasos: ['Busca por palabra o elige una pantalla.', 'Pulsa «Ver explicación» para leerla o «Recorrido» para verla en acción.'] }
  };
  const CORTA = { dashboard: 'Tu puntaje y cómo vas contra la meta', visitas: 'Cómo van las visitas a los PDV y por qué fallan', tareas: 'Cómo van las tareas y el equipo de frío', audit: 'Control de calidad de las justificaciones', sos: 'Share de percha y de espacios por semana', ganancias: 'Caras y rumas ganadas en los PDV', plan: 'Cuánto cubrir cada día para llegar a la meta', alcance: 'Avance real contra el plan, día por día', metas: 'Metas vigentes y su cumplimiento', registro: 'Explicar con un motivo lo no efectivo', pend: 'Lo que falta justificar y aviso por WhatsApp', informe: 'Resumen del mes por ECM y supervisor', rutero: 'PDV asignados y su ubicación', carga: 'Subir los reportes (solo administrador)', ecm: 'Mercaderistas, supervisor y región', catalogo: 'Clasificar las preguntas de las encuestas', config: 'Pesos, metas y reglas del puntaje', usuarios: 'Crear usuarios y cambiar claves', permisos: 'Qué ve y qué puede hacer cada tipo', motivos: 'Motivos y quién responsable', accesos: 'Quién entró y qué cambió', ayuda: 'Explicaciones, glosario y preguntas' };
  const guiado = () => { try { return localStorage.getItem('cn_ay_guiado') !== 'no'; } catch (e) { return true; } };
  const setGuiado = (v) => { try { localStorage.setItem('cn_ay_guiado', v ? 'si' : 'no'); } catch (e) { } };
  const plano = (h) => String(h || '').replace(/<[^>]+>/g, '');
  const GLOS = [['ECM / BDR', 'El mercaderista, identificado por su código (ECM035).'], ['PDV', 'Punto de venta (cliente), con código numérico.'], ['Visita efectiva', 'Realizada, dentro del rango del PDV y con duración mínima (2 min).'], ['Perdida', 'Visita programada que no se realizó.'], ['Fuera de rango', 'Visita hecha lejos del PDV.'], ['Tarea E / M / F / P', 'Efectiva, mal ejecutada, justificada o pendiente.'], ['Justificar', 'Explicar con un motivo por qué algo no fue efectivo. Si el responsable es CN, no penaliza.'], ['SOS', 'Share de percha: parte de la percha que ocupan las marcas CN.'], ['SOE', 'Share de espacios: bandejas y rumas de CN.'], ['Espacios ganados', 'Caras o rumas conseguidas en un PDV.'], ['Semana operativa', 'De miércoles a martes.'], ['Involves', 'Herramienta de campo donde se registran visitas, tareas y fotos.'], ['Puntaje', '20 % visitas, 30 % tareas, 30 % tareas de frío, 10 % SOS, 10 % SOE.']];
  const FAQ = [['No puedo entrar', 'Revisa tu código (sin @) y tu contraseña. Si dice «usuario no activo» o «demasiados intentos», espera unos minutos o avisa al administrador.'], ['No veo un menú', 'Cada tipo de usuario tiene permisos distintos. Pídelo al administrador.'], ['Hice cambios y no se guardaron', 'Faltó pulsar «Guardar cambios». Si sales sin guardar, se pierden.'], ['Una semana de SOS tiene pocos días', 'Lunes y martes no cuentan, y la semana va de miércoles a martes.'], ['Mi visita de hoy no aparece', 'Los datos se cargan después. Mira «Datos hasta…» arriba a la derecha.'], ['La pantalla no se actualiza', 'Recarga con Ctrl + F5 (computador) o cierra y abre el navegador (celular).'], ['No puedo subir la foto', 'Usa JPG, PNG o WebP de hasta 2 MB.']];

  const curKey = () => { const k = (location.hash || '#dashboard').slice(1).split('/')[0]; return NAV[k] ? k : 'dashboard'; };
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s));
  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight) && getComputedStyle(el).visibility !== 'hidden';

  /* ---------- panel de ayuda de la pantalla actual ---------- */
  function cierraPanel() { const p = document.getElementById('ayp'); if (p) { p.remove(); document.getElementById('ayb') && document.getElementById('ayb').focus(); } }
  function panel(key) {
    cierraPanel(); key = key || curKey(); const d = H[key] || { t: (NAV[key] || [key])[0], que: 'Aún no hay explicación para esta pantalla.', pasos: [] };
    const sub = CN.sub && CN.sub[key], tabs = sub ? sub.tabs() : [], actual = sub ? sub.cur() : '';
    const tabsHtml = tabs.length && d.tabs ? `<h3>Pestañas</h3><ul class="ay-tabs">${tabs.map(([k, n]) => `<li class="${k === actual ? 'on' : ''}"><b>${E(n)}</b>${k === actual ? ' <span class="ay-pill">estás aquí</span>' : ''}<br>${E(d.tabs[k] || '')}</li>`).join('')}</ul>` : '';
    const dTab = d.tabs && actual && d.tabs[actual] ? `<div class="ay-now"><b>Pestaña actual:</b> ${E((tabs.find((t) => t[0] === actual) || [])[1] || '')}<br>${E(d.tabs[actual])}</div>` : '';
    const el = document.createElement('aside'); el.id = 'ayp'; el.className = 'ay-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Ayuda: ' + d.t);
    el.innerHTML = `<div class="ay-h"><h2>${E(d.t)}</h2><button type="button" data-ay="x" aria-label="Cerrar ayuda">✕</button></div>
      <div class="ay-b"><p>${d.que}</p>${dTab}${d.pasos && d.pasos.length ? `<h3>Cómo se usa</h3><ol>${d.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>` : ''}${d.tips && d.tips.length ? `<h3>Buenas prácticas</h3><ul>${d.tips.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}${tabsHtml}</div>
      <div class="ay-f"><button type="button" class="pri" data-ay="tour">▶ Recorrido guiado</button><button type="button" data-ay="centro">Centro de ayuda</button></div>`;
    document.body.appendChild(el);
    el.onclick = (e) => { const a = e.target.closest('[data-ay]'); if (!a) return; if (a.dataset.ay === 'x') cierraPanel(); else if (a.dataset.ay === 'tour') { cierraPanel(); recorrido(key); } else if (a.dataset.ay === 'centro') { cierraPanel(); location.hash = '#ayuda'; } };
    el.querySelector('[data-ay="x"]').focus();
  }

  /* ---------- recorrido guiado ---------- */
  function recorrido(key) {
    key = key || curKey(); const d = H[key] || {};
    const base = [['#sb', 'Menú', 'Aquí están todas tus pantallas. Pulsa una para abrirla; las que tienen pestañas las muestran debajo.'], ['#ph', 'Dónde estás', 'El título muestra la pantalla y la pestaña actual.'], ['#ayb', 'Ayuda', 'Este botón (o la tecla ?) abre la explicación de la pantalla en que estés.']];
    const pasos = base.concat(d.tour || []).map(([sel, t, x]) => ({ el: [...document.querySelectorAll(sel)].find(visible), t, x })).filter((s) => s.el);
    if (!pasos.length) return panel(key);
    correr(pasos);
  }
  function correr(pasos) {
    let i = 0; const ov = document.createElement('div'); ov.className = 'ay-tour'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Recorrido guiado');
    const sp = document.createElement('div'); sp.className = 'ay-spot'; const tip = document.createElement('div'); tip.className = 'ay-tip'; ov.append(sp, tip); document.body.appendChild(ov);
    const fin = () => { ov.remove(); removeEventListener('keydown', tecla, true); removeEventListener('resize', pinta); };
    const pinta = () => {
      const s = pasos[i]; if (s.abrir) { const sb = document.getElementById('sb'); if (sb && !visible(sb)) sb.classList.add('open'); } s.el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'auto' : 'auto' }); const r = s.el.getBoundingClientRect(), pad = 6;
      Object.assign(sp.style, { top: r.top - pad + 'px', left: r.left - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      tip.innerHTML = `<div class="ay-step">Paso ${i + 1} de ${pasos.length}</div><b>${E(s.t)}</b><p>${E(s.x)}</p><div class="ay-btns"><button type="button" data-t="x">Salir</button><span style="flex:1"></span><button type="button" data-t="p" ${i ? '' : 'disabled'}>Anterior</button><button type="button" class="pri" data-t="n">${i === pasos.length - 1 ? 'Terminar' : 'Siguiente'}</button></div>`;
      const th = tip.offsetHeight || 150, w = Math.min(340, innerWidth - 24); tip.style.width = w + 'px';
      if (s.el.closest('#sb') && innerWidth - r.right > w + 30) { tip.style.left = r.right + 16 + 'px'; tip.style.top = Math.min(Math.max(8, r.top), innerHeight - th - 8) + 'px'; tip.querySelector('[data-t="n"]').focus(); return; }
      let top = r.bottom + 14; if (top + th > innerHeight - 8) top = Math.max(8, r.top - th - 14); if (top < 8) top = 8; let left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
      tip.style.top = top + 'px'; tip.style.left = left + 'px'; tip.querySelector('[data-t="n"]').focus();
    };
    const sig = () => { if (i < pasos.length - 1) { i++; pinta(); } else fin(); }, ant = () => { if (i) { i--; pinta(); } };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fin(); } else if (e.key === 'ArrowRight') sig(); else if (e.key === 'ArrowLeft') ant(); };
    tip.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; ({ x: fin, n: sig, p: ant })[b.dataset.t](); }; ov.onclick = (e) => { if (e.target === ov) fin(); };
    addEventListener('keydown', tecla, true); addEventListener('resize', pinta); pinta();
  }

  function recorridoMenu() {
    const sb = document.getElementById('sb'); if (sb && !visible(sb)) sb.classList.add('open');
    const pasos = [{ el: sb, t: 'Tu menú', x: 'Aquí está todo lo que puedes usar. Te explicamos para qué sirve cada opción. Usa las flechas del teclado o los botones.', abrir: 1 }];
    [...document.querySelectorAll('#nav .sbtn[data-go]')].forEach((b) => { const k = b.dataset.go, d = H[k]; if (!d) return; pasos.push({ el: b, abrir: 1, t: d.t, x: plano(d.que) + (d.tabs ? ' Tiene pestañas: al abrirla las verás debajo, en el menú, cada una con su explicación al pasar el mouse.' : '') }); });
    pasos.push({ el: document.getElementById('ayb'), t: '¿Dudas?', x: 'En cualquier pantalla, el botón ? (o la tecla ?) te explica qué es y cómo se usa. También hay un Centro de ayuda en el menú.' });
    correr(pasos.filter((p) => p.el));
  }

  /* ---------- explicaciones siempre visibles: menú, pestañas y franja de cada pantalla ---------- */
  function anotaMenu() {
    const cur = curKey(), d = H[cur] || {};
    document.querySelectorAll('#nav .sbtn[data-go]').forEach((b) => {
      const k = b.dataset.go, c = CORTA[k]; if (!c) return; b.title = c; const sp = b.querySelector('span'); if (!sp) return;
      let sm = b.querySelector('.ay-sub'); if (guiado()) { if (!sm) { sm = document.createElement('small'); sm.className = 'ay-sub'; sp.appendChild(sm); } sm.textContent = c; } else if (sm) sm.remove();
    });
    document.querySelectorAll('#nav [data-sub]').forEach((b) => { const tk = b.dataset.sub.split('|')[1], t = d.tabs && d.tabs[tk]; if (t) b.title = t; });
  }
  let firmaIntro = '';
  function franja() {
    const m = document.getElementById('main'); if (!m || !S.me) return; const key = curKey(); if (key === 'ayuda') return;
    const d = H[key], sub = CN.sub && CN.sub[key], actual = sub ? sub.cur() : '', tabs = sub ? sub.tabs() : [];
    const tn = (tabs.find((t) => t[0] === actual) || [])[1], td = d && d.tabs && d.tabs[actual];
    const sig = [key, actual, guiado()].join('|'); const ex = m.querySelector(':scope > .ay-intro');
    if (!guiado() || !d) { if (ex) ex.remove(); return; } if (ex && ex.dataset.k === sig) return; if (ex) ex.remove();
    const el = document.createElement('div'); el.className = 'ay-intro'; el.dataset.k = sig;
    el.innerHTML = `<div class="ay-i"><b>${E(d.t)}</b> · ${plano(d.que)}${tn && td ? `<br><span class="ay-tb"><b>${E(tn)}:</b> ${E(td)}</span>` : ''}</div><div class="ay-ib"><button type="button" data-i="uso">Cómo se usa</button><button type="button" data-i="tour">▶ Recorrido</button><button type="button" data-i="ocultar" title="Ocultar las explicaciones (se vuelven a activar en el menú)">Ocultar</button></div>`;
    el.onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; if (b.dataset.i === 'uso') panel(key); else if (b.dataset.i === 'tour') recorrido(key); else { setGuiado(false); anotaMenu(); franja(); actualizaToggle(); } };
    m.prepend(el);
  }
  function actualizaToggle() { const t = document.getElementById('ayt'); if (t) { t.querySelector('span').textContent = guiado() ? 'Explicaciones: activadas' : 'Explicaciones: desactivadas'; t.setAttribute('aria-pressed', guiado()); } }
  function toggle() {
    const foot = document.querySelector('#sb .foot'); if (!foot || document.getElementById('ayt')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'ayt'; b.className = 'sbtn'; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span></span>';
    foot.insertBefore(b, foot.firstChild.nextSibling || null); b.onclick = () => { setGuiado(!guiado()); anotaMenu(); franja(); actualizaToggle(); }; actualizaToggle();
  }

  /* ---------- botón «?» y bienvenida ---------- */
  function boton() {
    const head = document.querySelector('.pagehead'); if (!head || document.getElementById('ayb')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'ayb'; b.className = 'ay-btn'; b.textContent = '?'; b.title = 'Ayuda de esta pantalla (tecla ?)'; b.setAttribute('aria-label', 'Ayuda de esta pantalla');
    const f = document.getElementById('fresh'); head.insertBefore(b, f || null); b.onclick = () => panel();
  }
  function bienvenida(forzar) {
    const k = 'cn_ayuda_' + (S.me && S.me.usuario); if (!forzar) { try { if (localStorage.getItem(k)) return; } catch (e) { return; } }
    const c = document.createElement('div'); c.className = 'modal ay-wm'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', 'Bienvenida');
    const nom = E((S.me.nombre || '').split(' ')[0] || ''), rol = E(S.me.perfilNombre || '');
    c.innerHTML = `<div class="box" style="max-width:480px"><h2 style="margin:0;color:var(--brand)">¡Bienvenido/a${nom ? ', ' + nom : ''}!</h2><p>Esta plataforma te muestra cómo van tus visitas, tareas y share de góndola, y te ayuda a justificar lo que no salió como esperabas.${rol ? ' Tu perfil es <b>' + rol + '</b>.' : ''}</p>
      <p>Te recomendamos un <b>recorrido de un minuto</b> por tu menú: te explicamos para qué sirve cada opción y sus pestañas.</p><p class="note">Siempre verás una explicación corta en cada menú y pantalla. Puedes ocultarla o volver a verla desde el menú («Explicaciones»).</p>
      <div class="ay-btns" style="flex-wrap:wrap"><button type="button" data-w="no">Ahora no</button><span style="flex:1"></span><button type="button" class="pri" data-w="si">▶ Empezar recorrido</button></div></div>`;
    document.body.appendChild(c); const listo = () => { try { localStorage.setItem(k, '1'); } catch (e) { } c.remove(); };
    c.onclick = (e) => { const a = e.target.closest('[data-w]'); if (!a) return; listo(); if (a.dataset.w === 'si') recorridoMenu(); }; c.querySelector('[data-w="si"]').focus();
  }
  CN.ayuda = { panel, recorrido, recorridoMenu, bienvenida };
  const sideRef = CN.sideRefresh; CN.sideRefresh = function () { const r = sideRef.apply(this, arguments); try { boton(); toggle(); anotaMenu(); franja(); if (!window._ayB) { window._ayB = 1; setTimeout(() => bienvenida(), 900); const mo = new MutationObserver(() => { try { franja(); } catch (e) { } }); mo.observe(document.getElementById('main'), { childList: true }); } } catch (e) { } return r; };
  addEventListener('keydown', (e) => { if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') && document.getElementById('ayb')) { e.preventDefault(); panel(); } else if (e.key === 'Escape' && document.getElementById('ayp')) cierraPanel(); });

  /* ---------- Centro de ayuda ---------- */
  VIEWS.ayuda = async function () {
    const m = $('#main'), claves = Object.keys(H).filter((k) => k !== 'ayuda' && NAV[k] && veMod(k));
    const dibuja = (q) => {
      q = (q || '').trim().toLowerCase(); const txt = (k) => (H[k].t + ' ' + H[k].que + ' ' + (H[k].pasos || []).join(' ') + ' ' + (H[k].tips || []).join(' ')).replace(/<[^>]+>/g, '').toLowerCase();
      const L = claves.filter((k) => !q || txt(k).includes(q)), G = GLOS.filter(([a, b]) => !q || (a + ' ' + b).toLowerCase().includes(q)), F = FAQ.filter(([a, b]) => !q || (a + ' ' + b).toLowerCase().includes(q));
      $('#ay-res').innerHTML = `<h2>Pantallas${q ? ' · ' + L.length : ''}</h2><div class="ay-grid">${L.map((k) => `<div class="card"><h3>${E(H[k].t)}</h3><p class="note">${H[k].que}</p><div class="bar" style="margin:0"><button type="button" data-ayh="${k}">Ver explicación</button><button type="button" data-ayo="${k}">Abrir pantalla</button></div></div>`).join('') || '<p class="note">Sin resultados.</p>'}</div>
        <h2>Glosario</h2><div class="card"><dl class="ay-dl">${G.map(([a, b]) => `<dt>${E(a)}</dt><dd>${E(b)}</dd>`).join('') || '<p class="note">Sin resultados.</p>'}</dl></div>
        <h2>Preguntas frecuentes</h2>${F.map(([a, b]) => `<details class="card ay-faq"><summary>${E(a)}</summary><p>${E(b)}</p></details>`).join('') || '<p class="note">Sin resultados.</p>'}`;
    };
    m.innerHTML = `<div class="card"><h2 style="margin-top:0">Primeros pasos</h2><ol><li>Usa el <b>menú lateral</b> para abrir una pantalla.</li><li>En cada pantalla, el botón <b>?</b> (arriba a la derecha) explica qué es y cómo se usa.</li><li>Pulsa <b>Recorrido guiado</b> para ver la pantalla señalada paso a paso.</li></ol><div class="bar" style="margin:0"><button type="button" class="pri" id="ay-t">▶ Recorrido por mi menú</button></div></div>
      <div class="bar"><label style="flex:1;max-width:420px">Buscar en la ayuda<input id="ay-q" type="search" placeholder="Ej. justificar, semana, meta, clave…"></label></div><div id="ay-res"></div>`;
    dibuja(''); $('#ay-q').oninput = (e) => dibuja(e.target.value); $('#ay-t').onclick = () => recorridoMenu();
    m.addEventListener('click', (e) => { const h = e.target.closest('[data-ayh]'), o = e.target.closest('[data-ayo]'); if (h) panel(h.dataset.ayh); else if (o) location.hash = '#' + o.dataset.ayo; });
  };
})();
